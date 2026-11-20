import "server-only";
import { cache } from "react";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { c } from "@/lib/db/sql";
import { getDb, schema } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { bulkList, fabricsWithStock, ordersWithBalance, supplierDues } from "@/lib/queries";
import { addDays, today } from "@/lib/utils";

/*
 * Dashboard data, one loader per kind. cache() makes each run at most once per request even when
 * several cards use it (orders feed the strip, the figures and Deliveries).
 */

export const loadOrders = cache(() => ordersWithBalance());
export const loadBulk = cache(() => bulkList());
export const loadFabrics = cache(() => fabricsWithStock());
export const loadShop = cache(() => getSetting("shop"));
export const loadLists = cache(() => getSetting("lists"));
export const loadDues = cache(() => supplierDues());

export const loadToday = cache(async () => {
  const db = await getDb();
  const t = today();
  const { sales, payments, saleItems } = schema;
  const [salesToday, paysToday] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)`.mapWith(Number),
        net: sql<number>`coalesce(sum(${c(sales.net)}),0)`.mapWith(Number),
        metres: sql<number>`coalesce(sum((select sum(${c(saleItems.metres)}) from ${saleItems} where ${c(saleItems.saleId)} = ${c(sales.id)})),0)`.mapWith(Number),
      })
      .from(sales)
      .where(and(eq(sales.date, t), eq(sales.cancelled, false))),
    db
      .select({ amount: sql<number>`coalesce(sum(${c(payments.amount)}),0)`.mapWith(Number) })
      .from(payments)
      .where(eq(payments.date, t)),
  ]);
  return { bills: salesToday[0]?.count ?? 0, salesNet: salesToday[0]?.net ?? 0, metres: salesToday[0]?.metres ?? 0, paysToday: paysToday[0]?.amount ?? 0 };
});

export const loadIncome = cache(async (t: string) => {
  const db = await getDb();
  const from30 = addDays(t, -29);
  const { sales, payments } = schema;
  const [salesByDay, paysByDay] = await Promise.all([
    db
      .select({ date: sales.date, amount: sql<number>`coalesce(sum(${c(sales.net)}),0)`.mapWith(Number) })
      .from(sales)
      .where(and(gte(sales.date, from30), eq(sales.cancelled, false), eq(sales.stitchingHere, false)))
      .groupBy(sales.date),
    db
      .select({ date: payments.date, amount: sql<number>`coalesce(sum(${c(payments.amount)}),0)`.mapWith(Number) })
      .from(payments)
      .where(gte(payments.date, from30))
      .groupBy(payments.date),
  ]);
  // Dates as plain "YYYY-MM-DD" text whatever the driver returns
  const iso = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10));
  return { sales: salesByDay.map((r) => ({ date: iso(r.date), amount: r.amount })), pays: paysByDay.map((r) => ({ date: iso(r.date), amount: r.amount })) };
});

export const loadPendingSales = cache(async () => {
  const db = await getDb();
  const { sales } = schema;
  return db
    .select({ id: sales.id, billNo: sales.billNo, customerName: sales.customerName })
    .from(sales)
    .where(and(eq(sales.stitchingHere, true), isNull(sales.orderId), eq(sales.cancelled, false)));
});
