"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { col, fabricsExt } from "@/lib/db/ext";
import { features } from "@/lib/db/features";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { can } from "@/lib/permissions";
import { round2 } from "@/lib/utils";
import { fail, ok, optId, optText, reqDate, zodError, type Result } from "./util";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;
const c = (col: unknown) => col as never;

export type StockMoveResult = {
  id: number;
  code: string;
  metres: number;
  boughtBefore: number;
  boughtAfter: number;
  sold: number;
  balanceBefore: number;
  balanceAfter: number;
  /** Cost / metre — null for roles that may not see cost prices. */
  rateBefore: number | null;
  rateAfter: number | null;
};

/** Locks the fabric row and reads Bought, Sold and cost — everything a stock movement needs. */
async function lockFabric(tx: Tx, fabricId: number) {
  const [f] = await tx
    .select({
      id: schema.fabrics.id,
      code: schema.fabrics.code,
      purchaseMtr: schema.fabrics.purchaseMtr,
      costPerMtr: schema.fabrics.costPerMtr,
      openingMtr: col.fabricOpeningMtr,
    })
    .from(schema.fabrics)
    .where(eq(schema.fabrics.id, fabricId))
    .for("update");
  if (!f) return null;
  // Same rule as everywhere else: Sold = metres on bills that are not cancelled
  const [s] = await tx
    .select({ sold: sql<number>`coalesce(sum(${c(schema.saleItems.metres)}),0)`.mapWith(Number) })
    .from(schema.saleItems)
    .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
    .where(and(eq(schema.saleItems.fabricId, fabricId), eq(schema.sales.cancelled, false)));
  return { ...f, sold: round2(s.sold) };
}

/** First movement on this fabric: remember the first entry, so opening-stock capital stays as it was. */
async function openingSnapshot(tx: Tx, f: { id: number; purchaseMtr: number; costPerMtr: number; openingMtr: number | null }) {
  if (f.openingMtr == null) await tx.update(fabricsExt).set({ openingMtr: f.purchaseMtr, openingCostPerMtr: f.costPerMtr }).where(eq(fabricsExt.id, f.id));
}
const NOT_YET = "Add stock is not available yet — the database update for it has not run";

function done() {
  revalidatePath("/fabrics", "layout");
  revalidatePath("/opening-stock");
  revalidatePath("/capital");
  revalidatePath("/");
}

/* ───── Add stock (more of the same cloth arrived) ───── */

const AddStockInput = z.object({
  fabricId: z.number().int().positive(),
  metres: z.coerce.number<number>().positive("Enter the metres that arrived").max(100000),
  /** Cost / metre of this lot. Ignored (current cost kept) for roles that may not see cost prices. */
  rate: z.coerce.number<number>().min(0).optional().nullable(),
  date: reqDate,
  supplierId: optId,
  billNo: optText,
  remarks: optText,
});
export type AddStockInput = z.input<typeof AddStockInput>;

/**
 * Adds the NEW metres to the fabric's Bought total (never replaces it). If the lot's rate differs, the fabric's
 * cost becomes the weighted average of the stock on hand and the new lot.
 */
export async function addStock(input: AddStockInput): Promise<Result<StockMoveResult>> {
  const user = await requireUser();
  if (!(await features()).stock) return fail(NOT_YET);
  const parsed = AddStockInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const d = parsed.data;
  const seesCost = can(user.role, "costs");
  const db = await getDb();
  const res = await db.transaction(async (tx: Tx) => {
    const f = await lockFabric(tx, d.fabricId);
    if (!f) return null;
    const metres = round2(d.metres);
    const oldRate = f.costPerMtr;
    const lotRate = seesCost && d.rate != null ? round2(d.rate) : oldRate;
    const balanceBefore = round2(f.purchaseMtr - f.sold);
    // new rate = (old balance × old rate + new metres × new rate) / (old balance + new metres)
    // Stock already at or below zero has no value left to average with; an unpriced fabric (cost 0) takes the lot's rate.
    const onHand = Math.max(0, balanceBefore);
    const newRate = lotRate === oldRate ? oldRate : oldRate === 0 ? lotRate : round2((onHand * oldRate + metres * lotRate) / (onHand + metres));
    const boughtAfter = round2(f.purchaseMtr + metres);
    const balanceAfter = round2(boughtAfter - f.sold);
    await openingSnapshot(tx, f);
    await tx
      .update(schema.fabrics)
      .set({ purchaseMtr: boughtAfter, costPerMtr: newRate, updatedAt: new Date() })
      .where(eq(schema.fabrics.id, f.id));
    const [m] = await tx
      .insert(schema.fabricStockMoves)
      .values({
        fabricId: f.id,
        kind: "receipt",
        date: d.date,
        metres,
        rate: lotRate,
        supplierId: d.supplierId ?? null,
        billNo: d.billNo ?? null,
        remarks: d.remarks ?? null,
        boughtAfter,
        balanceAfter,
        rateBefore: oldRate,
        rateAfter: newRate,
        createdBy: user.name,
      })
      .returning({ id: schema.fabricStockMoves.id });
    await audit(tx, user, "update", "fabric", f.id, `${f.code}: +${metres} m stock received${d.billNo ? ` (bill ${d.billNo})` : ""}`);
    return { id: m.id, code: f.code, metres, boughtBefore: f.purchaseMtr, boughtAfter, sold: f.sold, balanceBefore, balanceAfter, rateBefore: oldRate, rateAfter: newRate };
  });
  if (!res) return fail("Fabric not found");
  done();
  return ok(seesCost ? res : { ...res, rateBefore: null, rateAfter: null });
}

/* ───── Adjust stock (corrections only) ───── */

const AdjustInput = z.object({
  fabricId: z.number().int().positive(),
  metres: z.coerce
    .number<number>()
    .refine((n) => n !== 0, "Enter a plus or minus figure")
    .refine((n) => Math.abs(n) <= 100000, "Too large"),
  date: reqDate,
  reason: z.string().trim().min(3, "A reason is required (damage, shortage, counting mistake…)"),
});
export type AdjustInput = z.input<typeof AdjustInput>;

/** A correction (+ or −) with a required reason. Logged separately from receipts; the cost per metre is unchanged. */
export async function adjustStock(input: AdjustInput): Promise<Result<StockMoveResult>> {
  const user = await requireUser({ can: "delete" });
  if (!(await features()).stock) return fail(NOT_YET);
  const parsed = AdjustInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const d = parsed.data;
  const db = await getDb();
  const res = await db.transaction(async (tx: Tx) => {
    const f = await lockFabric(tx, d.fabricId);
    if (!f) return { error: "Fabric not found" };
    const metres = round2(d.metres);
    const balanceBefore = round2(f.purchaseMtr - f.sold);
    const boughtAfter = round2(f.purchaseMtr + metres);
    const balanceAfter = round2(boughtAfter - f.sold);
    if (metres < 0 && balanceAfter < 0) return { error: `Only ${balanceBefore} m is in stock — cannot take off ${-metres} m` };
    await openingSnapshot(tx, f);
    await tx
      .update(schema.fabrics)
      .set({ purchaseMtr: boughtAfter, updatedAt: new Date() })
      .where(eq(schema.fabrics.id, f.id));
    const [m] = await tx
      .insert(schema.fabricStockMoves)
      .values({
        fabricId: f.id,
        kind: "adjust",
        date: d.date,
        metres,
        remarks: d.reason,
        boughtAfter,
        balanceAfter,
        rateBefore: f.costPerMtr,
        rateAfter: f.costPerMtr,
        createdBy: user.name,
      })
      .returning({ id: schema.fabricStockMoves.id });
    await audit(tx, user, "update", "fabric", f.id, `${f.code}: stock adjusted ${metres > 0 ? "+" : ""}${metres} m — ${d.reason}`);
    return { id: m.id, code: f.code, metres, boughtBefore: f.purchaseMtr, boughtAfter, sold: f.sold, balanceBefore, balanceAfter, rateBefore: f.costPerMtr, rateAfter: f.costPerMtr };
  });
  if ("error" in res) return fail(String(res.error));
  done();
  return ok(can(user.role, "costs") ? res : { ...res, rateBefore: null, rateAfter: null });
}

/* ───── Undo (the latest movement of a fabric only) ───── */

/** Takes back the most recent stock movement of its fabric — e.g. 50 typed instead of 5. Restores Bought and the cost. */
export async function undoStockMove(id: number): Promise<Result<{ code: string; balanceAfter: number }>> {
  const user = await requireUser();
  if (!(await features()).stock) return fail(NOT_YET);
  const db = await getDb();
  const res = await db.transaction(async (tx: Tx) => {
    const [m] = await tx.select().from(schema.fabricStockMoves).where(eq(schema.fabricStockMoves.id, id));
    if (!m) return { error: "Already undone" };
    // The person who added it may undo it straight away (toast Undo); otherwise only Owner / Partner
    const fresh = m.createdBy === user.name && Date.now() - new Date(m.createdAt).getTime() < 10 * 60_000;
    if (!fresh && !can(user.role, "delete")) return { error: "Only the Owner or a Partner can undo this" };
    const f = await lockFabric(tx, m.fabricId);
    if (!f) return { error: "Fabric not found" };
    const [latest] = await tx
      .select({ id: schema.fabricStockMoves.id })
      .from(schema.fabricStockMoves)
      .where(eq(schema.fabricStockMoves.fabricId, m.fabricId))
      .orderBy(desc(schema.fabricStockMoves.id))
      .limit(1);
    if (latest?.id !== m.id) return { error: "Only the latest stock entry of a fabric can be undone — use Adjust stock instead" };
    const bought = round2(f.purchaseMtr - m.metres);
    const balanceAfter = round2(bought - f.sold);
    if (balanceAfter < 0) return { error: `Cannot undo: ${f.sold} m has already been sold` };
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)`.mapWith(Number) })
      .from(schema.fabricStockMoves)
      .where(eq(schema.fabricStockMoves.fabricId, m.fabricId));
    await tx
      .update(schema.fabrics)
      .set({
        purchaseMtr: bought,
        // put the cost back only if nobody changed it by hand since
        ...(m.rateBefore != null && f.costPerMtr === m.rateAfter ? { costPerMtr: m.rateBefore } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.fabrics.id, f.id));
    // no movement left → the first entry is again the whole story
    if (n === 1) await tx.update(fabricsExt).set({ openingMtr: null, openingCostPerMtr: null }).where(eq(fabricsExt.id, f.id));
    await tx.delete(schema.fabricStockMoves).where(eq(schema.fabricStockMoves.id, m.id));
    await audit(tx, user, "delete", "fabric", f.id, `${f.code}: undid stock ${m.kind === "receipt" ? "receipt" : "adjustment"} of ${m.metres} m`);
    return { code: f.code, balanceAfter };
  });
  if ("error" in res) return fail(String(res.error));
  done();
  return ok(res);
}
