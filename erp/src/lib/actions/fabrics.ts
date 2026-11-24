"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { features } from "@/lib/db/features";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextNumber, pad } from "@/lib/numbering";
import { rememberDeleted } from "@/lib/import-tombstone";
import { can } from "@/lib/permissions";
import { PATTERNS } from "@/lib/fabric-patterns";
import { getSetting } from "@/lib/settings";
import { fail, money, ok, optDate, optId, optText, zodError, type Result } from "./util";
import { createUploadTargets, deletePhotos, isOurPhotoUrl, storageMode, type UploadTarget } from "@/lib/storage";

const HEX = z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Colour must be a hex value like #1F2A44");
const PhotoLog = z.object({
  imageWidth: z.number().int(),
  imageHeight: z.number().int(),
  cardFound: z.boolean(),
  cardLongPx: z.number().nullable(),
  cardShortPx: z.number().nullable(),
  mmPerPx: z.number().nullable(),
  periodPx: z.number().nullable(),
  repeatAxis: z.string().nullable(),
  repeatCount: z.number().nullable(),
  repeatStrength: z.number().nullable(),
  patternMm: z.number().nullable(),
  colours: z.array(z.object({ hex: HEX, share: z.number() })).max(3),
});

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
  /** Main photo first. Undefined = leave photos unchanged. url = customer-facing (card cropped out). */
  photos: z
    .array(
      z.object({
        url: z.string(),
        thumb: z.string(),
        /** Original WITH the scale card — measurement only. */
        original: z.string().nullable().optional(),
        /** What the analysis found, for the measurement log (only photos added now). */
        log: PhotoLog.nullable().optional(),
      }),
    )
    .max(4, "Up to 4 photos per fabric")
    .optional(),
  /** Pattern / colour (filled automatically from the main photo; "hand" values are never overwritten). */
  pattern: z.enum(PATTERNS).nullable().optional(),
  patternMm: z.coerce.number<number>().min(0).max(1000).nullable().optional(),
  patternMmSource: z.enum(["card", "hand"]).nullable().optional(),
  dominantHex: HEX.nullable().optional(),
  secondaryHexes: z.array(HEX).max(2).optional(),
  colourSources: z.array(z.enum(["auto", "hand"])).max(3).optional(),
});
export type FabricInput = z.input<typeof FabricInput>;

export async function saveFabric(input: FabricInput): Promise<Result<{ id: number; code: string }>> {
  const user = await requireUser();
  const parsed = FabricInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, photos, ...all } = parsed.data;
  // Without the cost-price / money permissions those fields were never shown — keep what is stored
  const { costPerMtr, broughtInBy, purchaseMtr, ...others } = all;
  // Bought is set once when the fabric is created — after that only Add stock / Adjust stock change it
  // (before the Add stock database update, the form still edits it, as it always did)
  const lockBought = !!id && (await features()).stock;
  const rest = { ...others, ...(lockBought ? {} : { purchaseMtr }), ...(can(user.role, "costs") ? { costPerMtr } : {}), ...(can(user.role, "money") ? { broughtInBy } : {}) };
  if (photos?.some((p) => !isOurPhotoUrl(p.url) || !isOurPhotoUrl(p.thumb) || (p.original && !isOurPhotoUrl(p.original)))) return fail("Photo link not recognised — please upload again");
  // Pattern size only belongs to checks and stripes
  if (rest.pattern && rest.pattern !== "Check" && rest.pattern !== "Stripe") (rest.patternMm = null), (rest.patternMmSource = null);
  if (rest.patternMm == null) rest.patternMmSource = null;
  const d = {
    ...rest,
    ...(photos
      ? { photoUrls: photos.map((p) => p.url), thumbUrls: photos.map((p) => p.thumb), photoOriginalUrls: photos.map((p) => p.original ?? null), thumbnailUrl: photos[0]?.thumb ?? null }
      : {}),
  };
  const db = await getDb();
  let row;
  if (id) {
    const [before] = await db
      .select({ photoUrls: schema.fabrics.photoUrls, thumbUrls: schema.fabrics.thumbUrls, originals: schema.fabrics.photoOriginalUrls })
      .from(schema.fabrics)
      .where(eq(schema.fabrics.id, id));
    [row] = await db.update(schema.fabrics).set(d).where(eq(schema.fabrics.id, id)).returning();
    if (photos && before) {
      const keep = new Set([...row.photoUrls, ...row.thumbUrls, ...row.photoOriginalUrls.filter((u): u is string => !!u)]);
      await deletePhotos([...before.photoUrls, ...before.thumbUrls, ...before.originals.filter((u): u is string => !!u)].filter((u) => !keep.has(u)));
    }
    await audit(db, user, "update", "fabric", row.id, row.code);
  } else {
    const comps = await getSetting("compositions");
    const prefix = comps.find((c) => c.name === d.composition)?.prefix ?? "OTH";
    const code = `${prefix}-${pad(await nextNumber(db, `fabric:${prefix}`), 3)}`;
    [row] = await db.insert(schema.fabrics).values({ ...d, code }).returning();
    await audit(db, user, "create", "fabric", row.id, `${row.code} ${row.brand}`);
  }
  // Measurement log: one row per newly analysed photo (card size, repeat, mm, colours)
  const logs = (photos ?? []).filter((p) => p.log);
  if (logs.length)
    await db.insert(schema.fabricPhotoLog).values(logs.map((p) => ({ ...p.log!, fabricId: row.id, photoUrl: p.url, originalUrl: p.original ?? null, createdBy: user.name })));
  revalidatePath("/fabrics");
  revalidatePath("/opening-stock");
  revalidatePath("/capital");
  revalidatePath("/settings");
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
export async function getPhotoUploadTargets(ext: "webp" | "jpg", withOriginal = false): Promise<Result<{ photo: UploadTarget; thumb: UploadTarget; original?: UploadTarget }>> {
  await requireUser();
  if (ext !== "webp" && ext !== "jpg") return fail("Unsupported image type");
  try {
    return ok(await createUploadTargets(ext, withOriginal === true));
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function photoStorageAvailable() {
  await requireUser();
  return storageMode() !== "off";
}
