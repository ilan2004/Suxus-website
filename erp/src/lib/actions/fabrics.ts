"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextNumber, pad } from "@/lib/numbering";
import { getSetting } from "@/lib/settings";
import { fail, money, ok, optDate, optId, optText, zodError, type Result } from "./util";

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
});
export type FabricInput = z.input<typeof FabricInput>;

export async function saveFabric(input: FabricInput): Promise<Result<{ id: number; code: string }>> {
  const user = await requireUser();
  const parsed = FabricInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, ...d } = parsed.data;
  const db = await getDb();
  let row;
  if (id) {
    [row] = await db.update(schema.fabrics).set(d).where(eq(schema.fabrics.id, id)).returning();
    await audit(db, user, "update", "fabric", row.id, row.code);
  } else {
    const comps = await getSetting("compositions");
    const prefix = comps.find((c) => c.name === d.composition)?.prefix ?? "OTH";
    const code = `${prefix}-${pad(await nextNumber(db, `fabric:${prefix}`), 3)}`;
    [row] = await db.insert(schema.fabrics).values({ ...d, code }).returning();
    await audit(db, user, "create", "fabric", row.id, `${row.code} ${row.brand}`);
  }
  revalidatePath("/fabrics");
  return ok({ id: row.id, code: row.code });
}

export async function deleteFabric(id: number): Promise<Result<"deleted" | "deactivated">> {
  const user = await requireUser({ partner: true });
  const db = await getDb();
  const used = await db.select({ id: schema.saleItems.id }).from(schema.saleItems).where(eq(schema.saleItems.fabricId, id)).limit(1);
  if (used.length) {
    await db.update(schema.fabrics).set({ active: false }).where(eq(schema.fabrics.id, id));
    await audit(db, user, "update", "fabric", id, "deactivated");
    revalidatePath("/fabrics");
    return ok("deactivated");
  }
  await db.delete(schema.fabrics).where(eq(schema.fabrics.id, id));
  await audit(db, user, "delete", "fabric", id);
  revalidatePath("/fabrics");
  return ok("deleted");
}
