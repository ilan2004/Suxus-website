"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { postCash, removeCash } from "@/lib/cashbook";
import { round2 } from "@/lib/utils";
import { fail, money, ok, optText, reqDate, zodError, type Result } from "./util";

const WageLine = z.object({
  item: z.string().trim().min(1, "Item is required"),
  qty: z.coerce.number<number>().int().positive("Qty must be at least 1"),
  rate: z.coerce.number<number>().min(0),
});

const WageInput = z.object({
  id: z.number().int().optional(),
  date: reqDate,
  tailorId: z.number().int().positive("Choose the tailor"),
  orderNo: optText,
  lines: z.array(WageLine).min(1),
  paid: money,
  paidMode: z.string().default("Cash"),
  remarks: optText,
});
export type WageInput = z.input<typeof WageInput>;

/** Adds one wage row per line (e.g. 2 × Shirt, 1 × Pant for one order). */
export async function saveWages(input: WageInput): Promise<Result<null>> {
  const user = await requireUser();
  const parsed = WageInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, lines, paid, paidMode, ...d } = parsed.data;
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [t] = await tx.select({ name: schema.staff.name }).from(schema.staff).where(eq(schema.staff.id, d.tailorId));
    let remainingPaid = paid;
    for (const [i, l] of lines.entries()) {
      const amount = round2(l.qty * l.rate);
      const rowPaid = i === lines.length - 1 ? remainingPaid : Math.min(remainingPaid, amount);
      remainingPaid = round2(remainingPaid - rowPaid);
      const values = { ...d, ...l, amount, paid: rowPaid };
      let row;
      if (id && i === 0) [row] = await tx.update(schema.tailorWages).set(values).where(eq(schema.tailorWages.id, id)).returning();
      else [row] = await tx.insert(schema.tailorWages).values(values).returning();
      await postCash(tx, {
        source: "wage",
        sourceId: row.id,
        date: d.date,
        particulars: `Wage ${t?.name ?? ""} · ${l.qty} × ${l.item}${d.orderNo ? ` (${d.orderNo})` : ""}`,
        category: "Tailor Wages",
        amountOut: rowPaid,
        mode: paidMode,
      });
    }
    await audit(tx, user, id ? "update" : "create", "tailor_wage", id ?? null, `${t?.name} ${lines.length} line(s)`);
  });
  revalidatePath("/wages");
  return ok(null);
}

export async function deleteWage(id: number): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const db = await getDb();
  await db.delete(schema.tailorWages).where(eq(schema.tailorWages.id, id));
  await removeCash(db, "wage", id);
  await audit(db, user, "delete", "tailor_wage", id);
  revalidatePath("/wages");
  return ok(null);
}

const PayInput = z.object({
  tailorId: z.number().int().positive(),
  date: reqDate,
  amount: z.coerce.number<number>().positive("Amount must be more than 0"),
  mode: z.string().min(1),
  note: optText,
});

export async function payTailor(input: z.input<typeof PayInput>): Promise<Result<null>> {
  const user = await requireUser();
  const parsed = PayInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const d = parsed.data;
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [t] = await tx.select({ name: schema.staff.name }).from(schema.staff).where(eq(schema.staff.id, d.tailorId));
    const [p] = await tx.insert(schema.wagePayments).values(d).returning();
    await postCash(tx, {
      source: "wage_payment",
      sourceId: p.id,
      date: d.date,
      particulars: `Wages paid · ${t?.name ?? ""}${d.note ? ` · ${d.note}` : ""}`,
      category: "Tailor Wages",
      amountOut: d.amount,
      mode: d.mode,
    });
    await audit(tx, user, "create", "wage_payment", p.id, `${t?.name} ₹${d.amount}`);
  });
  revalidatePath("/wages");
  return ok(null);
}

export async function deleteWagePayment(id: number): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const db = await getDb();
  await db.delete(schema.wagePayments).where(eq(schema.wagePayments.id, id));
  await removeCash(db, "wage_payment", id);
  await audit(db, user, "delete", "wage_payment", id);
  revalidatePath("/wages");
  return ok(null);
}
