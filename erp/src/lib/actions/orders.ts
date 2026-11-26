"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getSetting } from "@/lib/settings";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { nextDocNo, resetCounterToMax } from "@/lib/numbering";
import { postCash, removeCash } from "@/lib/cashbook";
import { round2, today } from "@/lib/utils";
import { intlOrAsTyped } from "@/lib/phone";
import { fail, money, ok, optDate, optId, optText, reqDate, zodError, type Result } from "./util";
import { recalcOrder } from "@/lib/order-calc";
import { wearerFor } from "@/lib/wearer-db";
import { orderItemsExt, orderItemsVariant } from "@/lib/db/ext";
import { variantRequired, variantsFor } from "@/lib/variants";
import { features } from "@/lib/db/features";

const OrderInput = z.object({
  id: z.number().int().optional(),
  date: reqDate,
  customerId: optId,
  customerName: optText,
  phone: optText,
  workType: z.string().min(1, "Choose the work type"),
  urgency: z.string().default("Normal"),
  trialDate: optDate,
  deliveryDate: optDate,
  status: z.string().default("Booked"),
  broughtById: optId,
  saleId: optId,
  discount: money,
  remarks: optText,
  items: z
    // Each item has its own tailor (piece-rate wages follow the item); empty = not given out yet
    .array(z.object({ id: optId, item: z.string().min(1), qty: z.coerce.number<number>().int().positive(), rate: z.coerce.number<number>().min(0), tailorId: optId, wearerId: optId, fabricId: optId, variant: optText }))
    .min(1, "Add at least one item"),
  advance: money,
  advanceMode: z.string().default("Cash"),
});
export type OrderInput = z.input<typeof OrderInput>;

export async function saveOrder(input: OrderInput): Promise<Result<{ id: number; orderNo: string }>> {
  const user = await requireUser();
  const parsed = OrderInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const d = parsed.data;
  if (!d.customerId && !d.customerName) return fail("Choose a customer or type a name");
  const db = await getDb();
  const feat = await features();

  // Variant (തരം): required for shirts and pants. An older item saved before variants existed may stay "not set"
  // while it is unchanged; a new item, or one whose garment was changed, must have one.
  if (feat.variant) {
    const lists = await getSetting("variants");
    const before = d.id
      ? new Map((await db.select({ id: schema.orderItems.id, item: schema.orderItems.item }).from(schema.orderItems).where(eq(schema.orderItems.orderId, d.id))).map((r) => [r.id, r.item]))
      : new Map<number, string>();
    for (const i of d.items) {
      const allowed = variantsFor(i.item, lists);
      if (i.variant && allowed.length && !allowed.includes(i.variant) && before.get(i.id ?? -1) !== i.item) return fail(`"${i.variant}" is not a variant of ${i.item} (Settings → Variants)`);
      const untouchedOld = !!i.id && before.get(i.id) === i.item;
      if (!i.variant && variantRequired(i.item) && !untouchedOld) return fail(`Choose the variant (തരം) for ${i.item}: ${allowed.join(" / ")}`);
    }
  }

  try {
    const res = await db.transaction(async (tx) => {
      let customerName = d.customerName;
      let phone = intlOrAsTyped(d.phone);
      if (d.customerId) {
        const [c] = await tx.select().from(schema.customers).where(eq(schema.customers.id, d.customerId));
        customerName = c?.name ?? customerName;
        phone = c?.phone ?? phone;
      }
      const values = {
        date: d.date,
        customerId: d.customerId ?? null,
        customerName,
        phone,
        workType: d.workType,
        urgency: d.urgency,
        trialDate: d.trialDate,
        deliveryDate: d.deliveryDate,
        status: d.status,
        // Legacy order-level column: kept as the first item's tailor; everything reads the item tailors
        tailorId: d.items.find((i) => i.tailorId)?.tailorId ?? null,
        broughtById: d.broughtById ?? null,
        saleId: d.saleId ?? null,
        discount: d.discount,
        remarks: d.remarks,
        deliveredOn: d.status === "Delivered" ? today() : null,
      };

      let order;
      if (d.id) {
        const [prev] = await tx.select({ saleId: schema.orders.saleId }).from(schema.orders).where(eq(schema.orders.id, d.id));
        [order] = await tx.update(schema.orders).set({ ...values, updatedBy: user.name }).where(eq(schema.orders.id, d.id)).returning();
        if (prev?.saleId && prev.saleId !== d.saleId) {
          await tx.update(schema.sales).set({ orderId: null }).where(eq(schema.sales.id, prev.saleId));
        }
      } else {
        const orderNo = await nextDocNo(tx, "SO");
        [order] = await tx.insert(schema.orders).values({ ...values, orderNo, createdBy: user.name }).returning();
      }

      // Each item is someone's garment: one of the customer's wearers (empty = Self). Walk-ins without a customer have none.
      // Whose garment each item is (Wearers) — only once the database has it
      const hasWearers = feat.wearers;
      const wearerIds = await Promise.all(d.items.map((i) => (d.customerId && hasWearers ? wearerFor(tx, d.customerId, i.wearerId) : null)));
      const rows = d.items.map((i) => ({ orderId: order.id, item: i.item, qty: i.qty, rate: i.rate, amount: round2(i.qty * i.rate), tailorId: i.tailorId ?? null }));
      const savedIds: number[] = [];
      // Items keep their id when an order is edited: a printed bundle label (barcode = item id) and a shared
      // job slip link stay valid. Changed items are updated, new ones added, removed ones deleted.
      const existing = d.id ? (await tx.select({ id: schema.orderItems.id }).from(schema.orderItems).where(eq(schema.orderItems.orderId, order.id))).map((r) => r.id) : [];
      const keep = new Set<number>();
      for (const [n, i] of d.items.entries()) {
        if (i.id && existing.includes(i.id) && !keep.has(i.id)) {
          keep.add(i.id);
          await tx.update(schema.orderItems).set(rows[n]).where(eq(schema.orderItems.id, i.id));
          savedIds.push(i.id);
        } else savedIds.push((await tx.insert(schema.orderItems).values(rows[n]).returning({ id: schema.orderItems.id }))[0].id);
      }
      if (hasWearers) for (const [n, itemId] of savedIds.entries()) await tx.update(orderItemsExt).set({ wearerId: wearerIds[n] }).where(eq(orderItemsExt.id, itemId));
      if (feat.variant) for (const [n, itemId] of savedIds.entries()) await tx.update(orderItemsVariant).set({ variant: d.items[n].variant ?? null }).where(eq(orderItemsVariant.id, itemId));
      // Which fabric each garment is cut from (fabric requirement estimate). Never touches stock: only bills do.
      if (feat.itemFabric) {
        await tx.delete(schema.orderItemFabrics).where(inArray(schema.orderItemFabrics.orderItemId, savedIds));
        const pairs = savedIds.map((itemId, n) => ({ orderItemId: itemId, fabricId: d.items[n].fabricId ?? null })).filter((x): x is { orderItemId: number; fabricId: number } => !!x.fabricId);
        if (pairs.length) await tx.insert(schema.orderItemFabrics).values(pairs);
      }
      const gone = existing.filter((x) => !keep.has(x));
      if (gone.length) await tx.delete(schema.orderItems).where(inArray(schema.orderItems.id, gone));

      if (d.saleId) {
        // Fabric is now billed through this order: link it and drop its separate cash entry.
        await tx.update(schema.sales).set({ orderId: order.id, stitchingHere: true }).where(eq(schema.sales.id, d.saleId));
        await removeCash(tx, "sale", d.saleId);
      }
      await recalcOrder(tx, order.id);

      if (!d.id && d.advance > 0) {
        const [p] = await tx
          .insert(schema.payments)
          .values({ date: d.date, kind: "order", orderId: order.id, amount: d.advance, mode: d.advanceMode, note: "Advance", receivedById: user.id, createdBy: user.name })
          .returning();
        await postCash(tx, {
          source: "payment",
          sourceId: p.id,
          date: d.date,
          particulars: `${order.orderNo} advance · ${customerName ?? ""}`,
          category: "Advance Received",
          amountIn: d.advance,
          mode: d.advanceMode,
        });
      }
      await audit(tx, user, d.id ? "update" : "create", "order", order.id, order.orderNo);
      return { id: order.id, orderNo: order.orderNo };
    });
    revalidatePath("/orders");
    revalidatePath("/");
    return ok(res);
  } catch (e) {
    return fail((e as Error).message);
  }
}

export async function setOrderStatus(id: number, status: string): Promise<Result<{ from: string; to: string }>> {
  const user = await requireUser();
  const lists = await getSetting("lists");
  if (!lists.status.includes(status)) return fail(`Unknown stage: ${status}`);
  const db = await getDb();
  const [o] = await db.select({ status: schema.orders.status }).from(schema.orders).where(eq(schema.orders.id, id));
  if (!o) return fail("Order not found");
  if (o.status === status) return ok({ from: o.status, to: status });
  await db.transaction(async (tx) => {
    await tx
      .update(schema.orders)
      .set({ status, deliveredOn: status === "Delivered" ? today() : null, updatedBy: user.name })
      .where(eq(schema.orders.id, id));
    await tx.insert(schema.orderStatusChanges).values({ orderId: id, fromStatus: o.status, toStatus: status, changedBy: user.name });
    await audit(tx, user, "update", "order", id, `status ${o.status} → ${status}`);
  });
  revalidatePath("/orders");
  revalidatePath("/orders/board");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/");
  return ok({ from: o.status, to: status });
}

const PaymentInput = z.object({
  orderId: z.number().int().positive(),
  date: reqDate,
  amount: z.coerce.number<number>().positive("Amount must be more than 0"),
  mode: z.string().min(1),
  note: optText,
  markDelivered: z.boolean().default(false),
});

export async function addOrderPayment(input: z.input<typeof PaymentInput>): Promise<Result<null>> {
  const user = await requireUser();
  const parsed = PaymentInput.safeParse(input);
  if (!parsed.success) return fail(zodError(parsed.error));
  const d = parsed.data;
  const db = await getDb();
  await db.transaction(async (tx) => {
    const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, d.orderId));
    if (!o) throw new Error("Order not found");
    const [p] = await tx
      .insert(schema.payments)
      .values({ date: d.date, kind: "order", orderId: o.id, amount: d.amount, mode: d.mode, note: d.note, receivedById: user.id, createdBy: user.name })
      .returning();
    const category = o.workType === "Alteration" ? "Alteration Income" : "Stitching Income";
    await postCash(tx, {
      source: "payment",
      sourceId: p.id,
      date: d.date,
      particulars: `${o.orderNo} payment · ${o.customerName ?? ""}`,
      category,
      amountIn: d.amount,
      mode: d.mode,
    });
    if (d.markDelivered && o.status !== "Delivered") {
      await tx.update(schema.orders).set({ status: "Delivered", deliveredOn: d.date, updatedBy: user.name }).where(eq(schema.orders.id, o.id));
      await tx.insert(schema.orderStatusChanges).values({ orderId: o.id, fromStatus: o.status, toStatus: "Delivered", changedBy: user.name });
    }
    await audit(tx, user, "create", "payment", p.id, `${o.orderNo} ₹${d.amount}`);
  });
  revalidatePath(`/orders/${d.orderId}`);
  revalidatePath("/orders");
  revalidatePath("/");
  return ok(null);
}

export async function deletePayment(id: number): Promise<Result<null>> {
  const user = await requireUser({ can: "delete" });
  const db = await getDb();
  const [p] = await db.delete(schema.payments).where(eq(schema.payments.id, id)).returning();
  if (p) {
    await removeCash(db, "payment", id);
    await audit(db, user, "delete", "payment", id, `₹${p.amount}`);
    if (p.orderId) revalidatePath(`/orders/${p.orderId}`);
  }
  revalidatePath("/orders");
  return ok(null);
}

/**
 * Permanently deletes an order (e.g. a trial). Its payments leave the cash book.
 * withFabricBill: also delete the linked fabric bill (FS-) — otherwise the bill stays as a normal fabric sale.
 * Numbers are reused when the deleted order / bill was the latest one.
 */
export async function deleteOrder(id: number, opts?: { withFabricBill?: boolean }): Promise<Result<null>> {
  const user = await requireUser({ can: "delete" });
  const db = await getDb();
  await db.transaction(async (tx) => {
    const pays = await tx.select({ id: schema.payments.id }).from(schema.payments).where(eq(schema.payments.orderId, id));
    for (const p of pays) await removeCash(tx, "payment", p.id);
    if (opts?.withFabricBill) {
      const bills = await tx.select({ id: schema.sales.id, billNo: schema.sales.billNo }).from(schema.sales).where(eq(schema.sales.orderId, id));
      await tx.update(schema.orders).set({ saleId: null }).where(eq(schema.orders.id, id));
      for (const b of bills) {
        await removeCash(tx, "sale", b.id);
        await tx.delete(schema.sales).where(eq(schema.sales.id, b.id));
        await audit(tx, user, "delete", "sale", b.id, `${b.billNo} deleted with its order`);
      }
      if (bills.length) await resetCounterToMax(tx, "FS", "sales", "bill_no");
    }
    const linked = await tx
      .update(schema.sales)
      .set({ orderId: null, stitchingHere: false })
      .where(eq(schema.sales.orderId, id))
      .returning();
    for (const s of linked) {
      if (s.cancelled) continue;
      await postCash(tx, {
        source: "sale",
        sourceId: s.id,
        date: s.date,
        particulars: `${s.billNo} · ${s.customerName ?? "Walk-in"}`,
        category: "Fabric Sale",
        amountIn: s.net,
        mode: s.paymentMode,
      });
    }
    const [o] = await tx.delete(schema.orders).where(eq(schema.orders.id, id)).returning();
    await resetCounterToMax(tx, "SO", "orders", "order_no");
    await audit(tx, user, "delete", "order", id, o?.orderNo);
  });
  revalidatePath("/orders");
  revalidatePath("/sales");
  revalidatePath("/fabrics");
  revalidatePath("/");
  return ok(null);
}
