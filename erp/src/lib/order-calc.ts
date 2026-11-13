import "server-only";
import { eq, sql } from "drizzle-orm";
import { schema, type Tx } from "./db";
import { round2 } from "./utils";

/** Recomputes stitching / fabric / total for an order. */
export async function recalcOrder(tx: Tx, orderId: number) {
  const [o] = await tx.select().from(schema.orders).where(eq(schema.orders.id, orderId));
  if (!o) return;
  const [st] = await tx
    .select({ s: sql<number>`coalesce(sum(${schema.orderItems.amount}),0)`.mapWith(Number) })
    .from(schema.orderItems)
    .where(eq(schema.orderItems.orderId, orderId));
  let fabricAmount = 0;
  if (o.saleId) {
    const [s] = await tx.select({ net: schema.sales.net, cancelled: schema.sales.cancelled }).from(schema.sales).where(eq(schema.sales.id, o.saleId));
    if (s && !s.cancelled) fabricAmount = s.net;
  }
  const stitchingAmount = round2(st.s);
  const total = round2(stitchingAmount + fabricAmount - o.discount);
  await tx.update(schema.orders).set({ stitchingAmount, fabricAmount, total }).where(eq(schema.orders.id, orderId));
}
