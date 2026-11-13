import "server-only";
import { c } from "@/lib/db/sql";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { customerOptions, staffOptions } from "@/lib/queries";
import type { LinkedSale } from "@/components/forms/order-form";

const itemsAgg = sql<string>`coalesce((select string_agg(${c(schema.saleItems.description)} || ' ' || ${c(schema.saleItems.metres)} || 'm', ', ') from ${schema.saleItems} where ${c(schema.saleItems.saleId)} = ${c(schema.sales.id)}),'')`;

const saleCols = {
  id: schema.sales.id,
  billNo: schema.sales.billNo,
  date: schema.sales.date,
  net: schema.sales.net,
  items: itemsAgg,
  customerId: schema.sales.customerId,
  customerName: schema.sales.customerName,
  phone: schema.sales.phone,
};

export async function loadOrderFormData(saleId?: number | null) {
  const db = await getDb();
  const [customers, staff, settings, unlinked] = await Promise.all([
    customerOptions(),
    staffOptions(),
    getSettings(),
    db
      .select(saleCols)
      .from(schema.sales)
      .where(and(isNull(schema.sales.orderId), eq(schema.sales.cancelled, false)))
      .orderBy(desc(schema.sales.id))
      .limit(60),
  ]);
  let sale: LinkedSale | null = null;
  if (saleId) {
    [sale] = await db.select(saleCols).from(schema.sales).where(eq(schema.sales.id, saleId));
  }
  return {
    customers,
    staff: staff.map((s) => ({ id: s.id, name: s.name, role: s.role })),
    lists: {
      workType: settings.lists.workType,
      item: settings.lists.item,
      status: settings.lists.status,
      paymentMode: settings.lists.paymentMode,
      customerType: settings.lists.customerType,
    },
    unlinkedSales: unlinked as LinkedSale[],
    sale: sale ?? null,
    rates: settings.pieceRates,
    days: { normal: settings.shop.normalDays, express: settings.shop.expressDays },
  };
}
