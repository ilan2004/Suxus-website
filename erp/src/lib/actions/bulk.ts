"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema, type Tx } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextDocNo, resetCounterToMax } from "@/lib/numbering";
import { postCash, removeCash } from "@/lib/cashbook";
import { round2 } from "@/lib/utils";
import { intlOrAsTyped } from "@/lib/phone";
import { fail, money, ok, optDate, optId, optText, reqDate, zodError, type Result } from "./util";

const BulkInput = z.object({
  id: z.number().int().optional(),
  date: reqDate,
  institution: z.string().trim().min(1, "Institution name is required"),
  address: optText,
  contactPerson: optText,
  phone: optText,
  gstin: optText,
  fabricBy: optText,
  deliveryDate: optDate,
  status: z.string().default("Booked"),
  broughtById: optId,
  discount: money,
  gstPct: z.coerce.number<number>().min(0).max(28).default(0),
  remarks: optText,
  items: z
    .array(
      z.object({
        item: z.string().trim().min(1, "Item is required"),
        description: optText,
        size: optText,
        qty: z.coerce.number<number>().int().positive("Qty must be at least 1"),
        rate: z.coerce.number<number>().min(0),
      }),
    )
    .min(1, "Add at least one line"),
  advance: money,
  advanceMode: z.string().default("Cash"),
});
export type BulkInput = z.input<typeof BulkInput>;

async function totals(tx: Tx, id: number, discount: number, gstPct: number) {
  const [s] = await tx
    .select({ s: sql<number>`coalesce(sum(${schema.bulkOrderItems.amount}),0)`.mapWith(Number) })
    .from(schema.bulkOrderItems)
    .where(eq(schema.bulkOrderItems.bulkOrderId, id));
  const subtotal = round2(s.s);
  const taxable = round2(subtotal - discount);
  const gstAmount = round2((taxable * gstPct) / 100);
  await tx
    .update(schema.bulkOrders)
    .set({ subtotal, gstAmount, total: round2(taxable + gstAmount) })
    .where(eq(schema.bulkOrders.id, id));
}

export async function saveBulkOrder(input: BulkInput): Promise<Result<{ id: number; orderNo: string }>> {
  const user = await requireUser();
  const parsed = BulkInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const { id, items, advance, advanceMode, ...d } = parsed.data;
  const db = await getDb();
  try {
    const res = await db.transaction(async (tx) => {
      const values = { ...d, phone: intlOrAsTyped(d.phone), broughtById: d.broughtById ?? null };
      let row;
      if (id) {
        [row] = await tx.update(schema.bulkOrders).set(values).where(eq(schema.bulkOrders.id, id)).returning();
        await tx.delete(schema.bulkOrderItems).where(eq(schema.bulkOrderItems.bulkOrderId, id));
      } else {
        const orderNo = await nextDocNo(tx, "BO");
        [row] = await tx.insert(schema.bulkOrders).values({ ...values, orderNo }).returning();
      }
      await tx
        .insert(schema.bulkOrderItems)
        .values(items.map((i) => ({ ...i, bulkOrderId: row.id, amount: round2(i.qty * i.rate) })));
      await totals(tx, row.id, d.discount, d.gstPct);
      if (!id && advance > 0) {
        const [p] = await tx
          .insert(schema.payments)
          .values({ date: d.date, kind: "bulk", bulkOrderId: row.id, amount: advance, mode: advanceMode, note: "Advance", receivedById: user.id })
          .returning();
        await postCash(tx, {
          source: "payment",
          sourceId: p.id,
          date: d.date,
          particulars: `${row.orderNo} advance · ${d.institution}`,
          category: "Advance Received",
          amountIn: advance,
          mode: advanceMode,
        });
      }
      await audit(tx, user, id ? "update" : "create", "bulk_order", row.id, row.orderNo);
      return { id: row.id, orderNo: row.orderNo };
    });
    revalidatePath("/bulk");
    return ok(res);
  } catch (e) {
    return fail((e as Error).message);
  }
}

const PayInput = z.object({
  bulkOrderId: z.number().int().positive(),
  date: reqDate,
  amount: z.coerce.number<number>().positive("Amount must be more than 0"),
  mode: z.string().min(1),
  note: optText,
});

export async function addBulkPayment(input: z.input<typeof PayInput>): Promise<Result<null>> {
  const user = await requireUser();
  const parsed = PayInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const d = parsed.data;
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [o] = await tx.select().from(schema.bulkOrders).where(eq(schema.bulkOrders.id, d.bulkOrderId));
    if (!o) throw new Error("Order not found");
    const [p] = await tx
      .insert(schema.payments)
      .values({ date: d.date, kind: "bulk", bulkOrderId: o.id, amount: d.amount, mode: d.mode, note: d.note, receivedById: user.id })
      .returning();
    await postCash(tx, {
      source: "payment",
      sourceId: p.id,
      date: d.date,
      particulars: `${o.orderNo} payment · ${o.institution}`,
      category: "Bulk Order Income",
      amountIn: d.amount,
      mode: d.mode,
    });
    await audit(tx, user, "create", "payment", p.id, `${o.orderNo} ₹${d.amount}`);
  });
  revalidatePath(`/bulk/${d.bulkOrderId}`);
  revalidatePath("/bulk");
  return ok(null);
}

export async function setBulkStatus(id: number, status: string): Promise<Result<null>> {
  const user = await requireUser();
  const db = await getDb();
  await db.update(schema.bulkOrders).set({ status }).where(eq(schema.bulkOrders.id, id));
  await audit(db, user, "update", "bulk_order", id, `status → ${status}`);
  revalidatePath(`/bulk/${id}`);
  revalidatePath("/bulk");
  return ok(null);
}

export async function deleteBulkOrder(id: number): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const db = await getDb();
  await db.transaction(async (tx) => {
    const pays = await tx.select({ id: schema.payments.id }).from(schema.payments).where(eq(schema.payments.bulkOrderId, id));
    for (const p of pays) await removeCash(tx, "payment", p.id);
    const [o] = await tx.delete(schema.bulkOrders).where(eq(schema.bulkOrders.id, id)).returning();
    await resetCounterToMax(tx, "BO", "bulk_orders", "order_no");
    await audit(tx, user, "delete", "bulk_order", id, o?.orderNo);
  });
  revalidatePath("/bulk");
  return ok(null);
}

export async function deleteBulkPayment(id: number): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const db = await getDb();
  const [p] = await db.delete(schema.payments).where(eq(schema.payments.id, id)).returning();
  if (p) {
    await removeCash(db, "payment", id);
    await audit(db, user, "delete", "payment", id, `₹${p.amount}`);
    if (p.bulkOrderId) revalidatePath(`/bulk/${p.bulkOrderId}`);
  }
  return ok(null);
}

