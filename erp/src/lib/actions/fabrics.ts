"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextNumber, pad } from "@/lib/numbering";
import { rememberDeleted } from "@/lib/import-tombstone";
import { can } from "@/lib/permissions";
import { getSetting } from "@/lib/settings";
import { fail, money, ok, optDate, optId, optText, zodError, type Result } from "./util";
import { createUploadTargets, deletePhotos, isOurPhotoUrl, storageMode, type UploadTarget } from "@/lib/storage";

const FabricInput = z.object({
  id: z.number().int().optional(),
  brand: z.string().trim().min(1, "Brand / quality is required"),
  barcode: optText,
  type: optText,
  shade: optText,
  composition: z.string().trim().min(1, "Composition is required (it decides the code)"),
  colourFamily: optText,
  supplierId: optId,
  purchaseDate: optDate,
  purchaseMtr: money,
  costPerMtr: money,
  saleRate: money,
  remarks: optText,
  active: z.boolean().default(true),
  /** Opening stock: partner who brought this fabric in (null = business purchase). */
  broughtInBy: optText,
  /** Main photo first. Undefined = leave photos unchanged. */
  photos: z
    .array(z.object({ url: z.string(), thumb: z.string() }))
    .max(4, "Up to 4 photos per fabric")
    .optional(),
});
export type FabricInput = z.input<typeof FabricInput>;

export async function saveFabric(input: FabricInput): Promise<Result<{ id: number; code: string }>> {
  const user = await requireUser();
  const parsed = FabricInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, photos, ...all } = parsed.data;
  // Without the cost-price / money permissions those fields were never shown — keep what is stored
  const { costPerMtr, broughtInBy, ...others } = all;
  const rest = { ...others, ...(can(user.role, "costs") ? { costPerMtr } : {}), ...(can(user.role, "money") ? { broughtInBy } : {}) };
  if (photos?.some((p) => !isOurPhotoUrl(p.url) || !isOurPhotoUrl(p.thumb))) return fail("Photo link not recognised — please upload again");
  const d = {
    ...rest,
    ...(photos ? { photoUrls: photos.map((p) => p.url), thumbUrls: photos.map((p) => p.thumb), thumbnailUrl: photos[0]?.thumb ?? null } : {}),
  };
  const db = await getDb();
  let row;
  if (id) {
    const [before] = await db.select({ photoUrls: schema.fabrics.photoUrls, thumbUrls: schema.fabrics.thumbUrls }).from(schema.fabrics).where(eq(schema.fabrics.id, id));
    [row] = await db.update(schema.fabrics).set(d).where(eq(schema.fabrics.id, id)).returning();
    if (photos && before) {
      const keep = new Set([...row.photoUrls, ...row.thumbUrls]);
      await deletePhotos([...before.photoUrls, ...before.thumbUrls].filter((u) => !keep.has(u)));
    }
    await audit(db, user, "update", "fabric", row.id, row.code);
  } else {
    const comps = await getSetting("compositions");
    const prefix = comps.find((c) => c.name === d.composition)?.prefix ?? "OTH";
    const code = `${prefix}-${pad(await nextNumber(db, `fabric:${prefix}`), 3)}`;
    [row] = await db.insert(schema.fabrics).values({ ...d, code }).returning();
    await audit(db, user, "create", "fabric", row.id, `${row.code} ${row.brand}`);
  }
  revalidatePath("/fabrics");
  revalidatePath("/opening-stock");
  revalidatePath("/capital");
  return ok({ id: row.id, code: row.code });
}

export async function deleteFabric(id: number): Promise<Result<"deleted" | "deactivated">> {
  const user = await requireUser({ can: "delete" });
  const db = await getDb();
  const used = await db.select({ id: schema.saleItems.id }).from(schema.saleItems).where(eq(schema.saleItems.fabricId, id)).limit(1);
  if (used.length) {
    await db.update(schema.fabrics).set({ active: false }).where(eq(schema.fabrics.id, id));
    await audit(db, user, "update", "fabric", id, "deactivated");
    revalidatePath("/fabrics");
    return ok("deactivated");
  }
  await rememberDeleted(db, "fabric", [id]);
  const [gone] = await db.delete(schema.fabrics).where(eq(schema.fabrics.id, id)).returning();
  if (gone) await deletePhotos([...gone.photoUrls, ...gone.thumbUrls]);
  await audit(db, user, "delete", "fabric", id);
  revalidatePath("/fabrics");
  return ok("deleted");
}

/** Signed upload URLs for one photo and its thumbnail (browser uploads straight to storage). */
export async function getPhotoUploadTargets(ext: "webp" | "jpg"): Promise<Result<{ photo: UploadTarget; thumb: UploadTarget }>> {
  await requireUser();
  if (ext !== "webp" && ext !== "jpg") return fail("Unsupported image type");
  try {
    return ok(await createUploadTargets(ext));
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function photoStorageAvailable() {
  await requireUser();
  return storageMode() !== "off";
}
