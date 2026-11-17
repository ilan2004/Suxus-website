"use server";

import { revalidatePath } from "next/cache";
import { c } from "@/lib/db/sql";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema, type Tx } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextDocNo, resetCounterToMax } from "@/lib/numbering";
import { postCash, removeCash } from "@/lib/cashbook";
import { round2 } from "@/lib/utils";
import { intlOrAsTyped } from "@/lib/phone";
import { fail, money, ok, optId, optText, reqDate, zodError, type Result } from "./util";
import { recalcOrder } from "@/lib/order-calc";

const SaleInput = z.object({
  date: reqDate,
  customerId: optId,
  customerName: optText,
  phone: optText,
  items: z
    .array(
      z.object({
        fabricId: z.number().int().positive().nullable(),
        description: z.string().trim().min(1, "Item description is required"),
        metres: z.coerce.number<number>().positive("Metres must be more than 0"),
        rate: z.coerce.number<number>().min(0),
      }),
    )
    .min(1, "Add at least one fabric"),
  discount: money,
  paymentMode: z.string().min(1),
  soldById: optId,
  stitchingHere: z.boolean().default(false),
  orderId: optId,
  remarks: optText,
  /** Allow selling more metres than the stock shows. */
  force: z.boolean().default(false),
});
export type SaleInput = z.input<typeof SaleInput>;

async function stockShortfalls(tx: Tx, items: { fabricId: number | null; metres: number }[]) {
  const need = new Map<number, number>();
  for (const i of items) if (i.fabricId) need.set(i.fabricId, (need.get(i.fabricId) ?? 0) + i.metres);
  const short: string[] = [];
  for (const [fabricId, metres] of need) {
    const [f] = await tx.select({ code: schema.fabrics.code, purchaseMtr: schema.fabrics.purchaseMtr }).from(schema.fabrics).where(eq(schema.fabrics.id, fabricId));
    const [s] = await tx
      .select({ sold: sql<number>`coalesce(sum(${c(schema.saleItems.metres)}),0)`.mapWith(Number) })
      .from(schema.saleItems)
      .innerJoin(schema.sales, eq(schema.sales.id, schema.saleItems.saleId))
      .where(and(eq(schema.saleItems.fabricId, fabricId), eq(schema.sales.cancelled, false)));
    const balance = round2((f?.purchaseMtr ?? 0) - s.sold);
    if (metres > balance) short.push(`${f?.code}: only ${balance} m left`);
  }
  return short;
}

export async function createSale(input: SaleInput): Promise<Result<{ id: number; billNo: string; needsConfirm?: string[] }>> {
  const user = await requireUser();
  const parsed = SaleInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const d = parsed.data;
  const db = await getDb();

  try {
    const result = await db.transaction(async (tx) => {
      if (!d.force) {
        const short = await stockShortfalls(tx, d.items);
        if (short.length) return { id: 0, billNo: "", needsConfirm: short };
      }

      let customerName = d.customerName;
      let phone = intlOrAsTyped(d.phone);
      if (d.customerId) {
        const [c] = await tx.select().from(schema.customers).where(eq(schema.customers.id, d.customerId));
        customerName = c?.name ?? customerName;
        phone = c?.phone ?? phone;
      }

      const lines = d.items.map((i) => ({ ...i, amount: round2(i.metres * i.rate) }));
      const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
      if (d.discount > subtotal) throw new Error("Discount is more than the bill amount");
      const net = round2(subtotal - d.discount);
      const billNo = await nextDocNo(tx, "FS");
      const stitchingHere = d.stitchingHere || !!d.orderId;

      const [sale] = await tx
        .insert(schema.sales)
        .values({
          billNo,
          date: d.date,
          customerId: d.customerId ?? null,
          customerName,
          phone,
          subtotal,
          discount: d.discount,
          net,
          paymentMode: d.paymentMode,
          soldById: d.soldById ?? null,
          stitchingHere,
          orderId: d.orderId ?? null,
          remarks: d.remarks,
        })
        .returning();
      await tx.insert(schema.saleItems).values(lines.map((l) => ({ ...l, saleId: sale.id })));

      if (d.orderId) {
        await tx.update(schema.orders).set({ saleId: sale.id }).where(eq(schema.orders.id, d.orderId));
        await recalcOrder(tx, d.orderId);
      }
      // Fabric bought for stitching here is paid through the order, so no cash entry for it.
      if (!stitchingHere) {
        await postCash(tx, {
          source: "sale",
          sourceId: sale.id,
          date: d.date,
          particulars: `${billNo} · ${customerName ?? "Walk-in"}`,
          category: "Fabric Sale",
          amountIn: net,
          mode: d.paymentMode,
        });
      }
      await audit(tx, user, "create", "sale", sale.id, `${billNo} ₹${net}`);
      return { id: sale.id, billNo };
    });
    revalidatePath("/sales");
    revalidatePath("/fabrics");
    revalidatePath("/");
    return ok(result);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function cancelSale(id: number, reason: string): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [sale] = await tx
      .update(schema.sales)
      .set({ cancelled: true, remarks: sql`coalesce(${c(schema.sales.remarks)} || ' · ', '') || ${"Cancelled: " + reason}` })
      .where(and(eq(schema.sales.id, id), ne(schema.sales.cancelled, true)))
      .returning();
    if (!sale) return;
    await removeCash(tx, "sale", id);
    if (sale.orderId) {
      await tx.update(schema.orders).set({ saleId: null }).where(eq(schema.orders.id, sale.orderId));
      await recalcOrder(tx, sale.orderId);
    }
    await audit(tx, user, "update", "sale", id, `cancelled: ${reason}`);
  });
  revalidatePath("/sales");
  revalidatePath(`/sales/${id}`);
  revalidatePath("/fabrics");
  return ok(null);
}

/**
 * Permanently removes a cancelled bill (e.g. a trial entry). Only cancelled bills can be deleted —
 * real bills are cancelled instead so the numbering and history stay intact.
 * If it was the latest bill, the FS- counter steps back so the number is reused.
 */
export async function deleteCancelledSale(id: number): Promise<Result<null>> {
  const user = await requireUser({ partner: true });
  const db = await getDb();
  const res = await db.transaction(async (tx) => {
    const [sale] = await tx.select().from(schema.sales).where(eq(schema.sales.id, id));
    if (!sale) return "Bill not found";
    if (!sale.cancelled) return "Cancel the bill first — only cancelled bills can be deleted";
    await removeCash(tx, "sale", id);
    if (sale.orderId) {
      await tx.update(schema.orders).set({ saleId: null }).where(eq(schema.orders.id, sale.orderId));
      await recalcOrder(tx, sale.orderId);
    }
    await tx.delete(schema.sales).where(eq(schema.sales.id, id)); // items cascade
    await resetCounterToMax(tx, "FS", "sales", "bill_no"); // reuse the number if nothing was billed after it
    await audit(tx, user, "delete", "sale", id, `${sale.billNo} deleted (was cancelled: ${sale.remarks ?? ""})`);
    return null;
  });
  if (res) return fail(res);
  revalidatePath("/sales");
  revalidatePath("/fabrics");
  revalidatePath("/");
  return ok(null);
}
