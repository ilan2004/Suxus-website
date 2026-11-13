"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { postCash, removeCash } from "@/lib/cashbook";
import { incentiveFor } from "@/lib/reports";
import { fail, money, ok, optDate, optId, optText, reqDate, zodError, type Result } from "./util";

/* ───── Setup & renovation expenses ───── */

const SetupInput = z.object({
  id: z.number().int().optional(),
  date: reqDate,
  category: z.string().min(1, "Choose a category"),
  description: optText,
  paidTo: optText,
  supplierId: optId,
  paidBy: z.string().min(1, "Who paid? (needed for the capital account)"),
  amount: z.coerce.number<number>().refine((n) => n !== 0, "Amount cannot be 0"), // returns can be negative
  mode: optText,
  billNo: optText,
  hasBill: z.boolean().default(false),
  remarks: optText,
});
export type SetupInput = z.input<typeof SetupInput>;

export async function saveSetupExpense(input: SetupInput): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const parsed = SetupInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, ...d } = parsed.data;
  const db = await getDb();
  await db.transaction(async (tx) => {
    let row;
    if (id) [row] = await tx.update(schema.setupExpenses).set(d).where(eq(schema.setupExpenses.id, id)).returning();
    else [row] = await tx.insert(schema.setupExpenses).values(d).returning();
    // Only money paid from the business itself goes through the cash book; partners' own money is capital.
    if (d.paidBy === "Business Account" && d.amount > 0) {
      await postCash(tx, {
        source: "setup",
        sourceId: row.id,
        date: d.date,
        particulars: `${d.category}${d.description ? ` · ${d.description}` : ""}`,
        category: "Setup / Renovation",
        amountOut: d.amount,
        mode: d.mode ?? "Cash",
      });
    } else await removeCash(tx, "setup", row.id);
    await audit(tx, user, id ? "update" : "create", "setup_expense", row.id, `${d.category} ₹${d.amount}`);
  });
  revalidatePath("/setup-expenses");
  revalidatePath("/capital");
  return ok(null);
}

export async function deleteSetupExpense(id: number): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const db = await getDb();
  await db.delete(schema.setupExpenses).where(eq(schema.setupExpenses.id, id));
  await removeCash(db, "setup", id);
  await audit(db, user, "delete", "setup_expense", id);
  revalidatePath("/setup-expenses");
  revalidatePath("/capital");
  return ok(null);
}

/* ───── Opening stock & assets ───── */

const AssetInput = z.object({
  id: z.number().int().optional(),
  assetType: z.string().min(1, "Choose the asset type"),
  description: z.string().trim().min(1, "Describe the item"),
  qty: money,
  unitValue: money,
  ownedBy: z.string().min(1, "Whose is it?"),
  condition: optText,
  valuationDate: optDate,
  remarks: optText,
});
export type AssetInput = z.input<typeof AssetInput>;

export async function saveAsset(input: AssetInput): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const parsed = AssetInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, ...d } = parsed.data;
  const db = await getDb();
  if (id) await db.update(schema.openingStock).set(d).where(eq(schema.openingStock.id, id));
  else await db.insert(schema.openingStock).values(d);
  await audit(db, user, id ? "update" : "create", "opening_stock", id ?? null, d.description);
  revalidatePath("/opening-stock");
  revalidatePath("/capital");
  return ok(null);
}

export async function deleteAsset(id: number): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const db = await getDb();
  await db.delete(schema.openingStock).where(eq(schema.openingStock.id, id));
  await audit(db, user, "delete", "opening_stock", id);
  revalidatePath("/opening-stock");
  revalidatePath("/capital");
  return ok(null);
}

/* ───── Incentive payouts ───── */

const IncentiveInput = z.object({
  staffId: z.number().int().positive(),
  fromDate: reqDate,
  toDate: reqDate,
  paid: money,
  mode: z.string().default("Cash"),
  paidOn: reqDate,
  remarks: optText,
});

/** Saves the incentive for a person & period (recomputed on the server), recording what was paid. */
export async function recordIncentive(input: z.input<typeof IncentiveInput>): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const parsed = IncentiveInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const d = parsed.data;
  const calc = (await incentiveFor(d.fromDate, d.toDate)).find((r) => r.staffId === d.staffId);
  if (!calc) return fail("Staff not found");
  if (d.paid > calc.incentive + 0.01) return fail(`Paid is more than the incentive (₹${calc.incentive})`);
  const db = await getDb();
  await db.transaction(async (tx) => {
    const values = {
      staffId: d.staffId,
      fromDate: d.fromDate,
      toDate: d.toDate,
      business: calc.business,
      collected: calc.collected,
      ratePct: calc.rate,
      incentive: calc.incentive,
      paid: d.paid,
      remarks: d.remarks,
    };
    const [existing] = await tx
      .select({ id: schema.incentivePayouts.id })
      .from(schema.incentivePayouts)
      .where(and(eq(schema.incentivePayouts.staffId, d.staffId), eq(schema.incentivePayouts.fromDate, d.fromDate), eq(schema.incentivePayouts.toDate, d.toDate)));
    const [row] = existing
      ? await tx.update(schema.incentivePayouts).set(values).where(eq(schema.incentivePayouts.id, existing.id)).returning()
      : await tx.insert(schema.incentivePayouts).values(values).returning();
    await postCash(tx, {
      source: "incentive",
      sourceId: row.id,
      date: d.paidOn,
      particulars: `Incentive ${calc.name} · ${d.fromDate} to ${d.toDate}`,
      category: "Incentive Paid",
      amountOut: d.paid,
      mode: d.mode,
    });
    await audit(tx, user, existing ? "update" : "create", "incentive", row.id, `${calc.name} ₹${calc.incentive} paid ₹${d.paid}`);
  });
  revalidatePath("/incentive");
  return ok(null);
}

export async function deleteIncentive(id: number): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const db = await getDb();
  await db.delete(schema.incentivePayouts).where(eq(schema.incentivePayouts.id, id));
  await removeCash(db, "incentive", id);
  await audit(db, user, "delete", "incentive", id);
  revalidatePath("/incentive");
  return ok(null);
}
