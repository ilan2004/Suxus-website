import "server-only";
import { c } from "@/lib/db/sql";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, schema } from "./db";

const { staff, customers, fabrics, saleItems, sales, orders, orderItems, payments } = schema;

export async function staffOptions(activeOnly = true) {
  const db = await getDb();
  return db
    .select({ id: staff.id, name: staff.name, role: staff.role, pieceRate: staff.pieceRate })
    .from(staff)
    .where(activeOnly ? eq(staff.status, "Active") : undefined)
    .orderBy(asc(staff.code));
}

export async function customerOptions() {
  const db = await getDb();
  return db
    .select({ id: customers.id, code: customers.code, name: customers.name, phone: customers.phone, place: customers.place })
    .from(customers)
    .orderBy(asc(customers.name));
}

/** Metres sold per fabric (excluding cancelled bills). */
function soldSubquery() {
  return sql<number>`coalesce((
    select sum(${c(saleItems.metres)}) from ${saleItems}
    join ${sales} on ${c(sales.id)} = ${c(saleItems.saleId)}
    where ${c(saleItems.fabricId)} = ${c(fabrics.id)} and ${c(sales.cancelled)} = false
  ), 0)`.mapWith(Number);
}

export async function fabricsWithStock() {
  const db = await getDb();
  const sold = soldSubquery();
  const rows = await db
    .select({
      id: fabrics.id,
      code: fabrics.code,
      barcode: fabrics.barcode,
      brand: fabrics.brand,
      type: fabrics.type,
      shade: fabrics.shade,
      composition: fabrics.composition,
      colourFamily: fabrics.colourFamily,
      supplierId: fabrics.supplierId,
      purchaseDate: fabrics.purchaseDate,
      purchaseMtr: fabrics.purchaseMtr,
      costPerMtr: fabrics.costPerMtr,
      saleRate: fabrics.saleRate,
      remarks: fabrics.remarks,
      active: fabrics.active,
      soldMtr: sold,
    })
    .from(fabrics)
    .orderBy(asc(fabrics.code));
  return rows.map((r) => {
    const balance = Math.round((r.purchaseMtr - r.soldMtr) * 100) / 100;
    return { ...r, balanceMtr: balance, stockValue: Math.round(balance * r.costPerMtr), totalCost: Math.round(r.purchaseMtr * r.costPerMtr) };
  });
}
export type FabricRow = Awaited<ReturnType<typeof fabricsWithStock>>[number];

export async function fabricBalance(fabricId: number, excludeSaleId?: number) {
  const db = await getDb();
  const [f] = await db.select({ purchaseMtr: fabrics.purchaseMtr }).from(fabrics).where(eq(fabrics.id, fabricId));
  if (!f) return 0;
  const [s] = await db
    .select({ sold: sql<number>`coalesce(sum(${c(saleItems.metres)}),0)`.mapWith(Number) })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .where(and(eq(saleItems.fabricId, fabricId), eq(sales.cancelled, false), excludeSaleId ? ne(sales.id, excludeSaleId) : undefined));
  return f.purchaseMtr - s.sold;
}

/** Orders with paid & balance. */
export async function ordersWithBalance(where?: ReturnType<typeof eq>) {
  const db = await getDb();
  const paid = sql<number>`coalesce((select sum(${c(payments.amount)}) from ${payments} where ${c(payments.orderId)} = ${c(orders.id)}),0)`.mapWith(Number);
  const itemsSummary = sql<string>`coalesce((select string_agg(${c(orderItems.qty)} || ' × ' || ${c(orderItems.item)}, ', ') from ${orderItems} where ${c(orderItems.orderId)} = ${c(orders.id)}),'')`;
  const tailor = sql<string | null>`(select ${c(staff.name)} from ${staff} where ${c(staff.id)} = ${c(orders.tailorId)})`;
  const rows = await db
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      date: orders.date,
      customerId: orders.customerId,
      customerName: orders.customerName,
      phone: orders.phone,
      workType: orders.workType,
      urgency: orders.urgency,
      trialDate: orders.trialDate,
      deliveryDate: orders.deliveryDate,
      status: orders.status,
      tailorId: orders.tailorId,
      tailorName: tailor,
      total: orders.total,
      paid,
      items: itemsSummary,
    })
    .from(orders)
    .where(where)
    .orderBy(desc(orders.id));
  return rows.map((r) => ({ ...r, balance: Math.round((r.total - r.paid) * 100) / 100 }));
}
export type OrderRow = Awaited<ReturnType<typeof ordersWithBalance>>[number];

export async function orderPaid(orderId: number) {
  const db = await getDb();
  const [r] = await db
    .select({ s: sql<number>`coalesce(sum(${c(payments.amount)}),0)`.mapWith(Number) })
    .from(payments)
    .where(eq(payments.orderId, orderId));
  return r.s;
}

export async function salesList() {
  const db = await getDb();
  const items = sql<string>`coalesce((select string_agg(${c(saleItems.description)} || ' ' || ${c(saleItems.metres)} || 'm', ', ') from ${saleItems} where ${c(saleItems.saleId)} = ${c(sales.id)}),'')`;
  const metres = sql<number>`coalesce((select sum(${c(saleItems.metres)}) from ${saleItems} where ${c(saleItems.saleId)} = ${c(sales.id)}),0)`.mapWith(Number);
  const soldBy = sql<string | null>`(select ${c(staff.name)} from ${staff} where ${c(staff.id)} = ${c(sales.soldById)})`;
  const orderNo = sql<string | null>`(select ${c(orders.orderNo)} from ${orders} where ${c(orders.id)} = ${c(sales.orderId)})`;
  return db
    .select({
      id: sales.id,
      billNo: sales.billNo,
      date: sales.date,
      customerName: sales.customerName,
      phone: sales.phone,
      net: sales.net,
      discount: sales.discount,
      paymentMode: sales.paymentMode,
      stitchingHere: sales.stitchingHere,
      cancelled: sales.cancelled,
      items,
      metres,
      soldBy,
      orderNo,
    })
    .from(sales)
    .orderBy(desc(sales.id));
}
export type SaleRow = Awaited<ReturnType<typeof salesList>>[number];

export async function getSaleFull(id: number) {
  const db = await getDb();
  const [sale] = await db.select().from(sales).where(eq(sales.id, id));
  if (!sale) return null;
  const items = await db.select().from(saleItems).where(eq(saleItems.saleId, id)).orderBy(asc(saleItems.id));
  const [seller] = sale.soldById ? await db.select({ name: staff.name }).from(staff).where(eq(staff.id, sale.soldById)) : [];
  const [order] = sale.orderId ? await db.select({ id: orders.id, orderNo: orders.orderNo }).from(orders).where(eq(orders.id, sale.orderId)) : [];
  return { ...sale, items, soldByName: seller?.name ?? null, order: order ?? null };
}

export async function getOrderFull(id: number) {
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.id));
  const pays = await db.select().from(payments).where(eq(payments.orderId, id)).orderBy(asc(payments.id));
  const ids = [order.tailorId, order.broughtById].filter(Boolean) as number[];
  const people = ids.length ? await db.select({ id: staff.id, name: staff.name }).from(staff).where(inArray(staff.id, ids)) : [];
  const sale = order.saleId ? await getSaleFull(order.saleId) : null;
  const paid = pays.reduce((s, p) => s + p.amount, 0);
  return {
    ...order,
    items,
    payments: pays,
    sale,
    tailorName: people.find((p) => p.id === order.tailorId)?.name ?? null,
    broughtByName: people.find((p) => p.id === order.broughtById)?.name ?? null,
    paid,
    balance: Math.round((order.total - paid) * 100) / 100,
  };
}
export type OrderFull = NonNullable<Awaited<ReturnType<typeof getOrderFull>>>;
