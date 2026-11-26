import "server-only";
import { c } from "@/lib/db/sql";
import { and, asc, desc, eq, getTableColumns, inArray, ne, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { col, when } from "./db/ext";
import { features } from "./db/features";

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
    .select({
      id: customers.id,
      code: customers.code,
      name: customers.name,
      phone: customers.phone,
      place: customers.place,
      // Other people measured under this customer (children etc.) — so searching "Anas" finds his parent's account
      people: when((await features()).wearers, sql<string | null>`(select string_agg(${c(schema.wearers.name)}, ', ' order by ${c(schema.wearers.id)}) from ${schema.wearers} where ${c(schema.wearers.customerId)} = ${c(customers.id)} and not ${c(schema.wearers.isSelf)})`),
    })
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
  const { stock } = await features();
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
      // First-entry snapshot (Add stock) — null until the database has it
      ...(stock ? { openingMtr: col.fabricOpeningMtr, openingCostPerMtr: col.fabricOpeningCost } : { openingMtr: sql<number | null>`null`, openingCostPerMtr: sql<number | null>`null` }),
      saleRate: fabrics.saleRate,
      remarks: fabrics.remarks,
      active: fabrics.active,
      broughtInBy: fabrics.broughtInBy,
      photoUrls: fabrics.photoUrls,
      thumbUrls: fabrics.thumbUrls,
      photoOriginalUrls: fabrics.photoOriginalUrls,
      pattern: fabrics.pattern,
      patternMm: fabrics.patternMm,
      patternMmSource: fabrics.patternMmSource,
      dominantHex: fabrics.dominantHex,
      secondaryHexes: fabrics.secondaryHexes,
      colourSources: fabrics.colourSources,
      thumbnailUrl: fabrics.thumbnailUrl,
      soldMtr: sold,
    })
    .from(fabrics)
    .orderBy(asc(fabrics.code));
  return rows.map((r) => {
    const balance = Math.round((r.purchaseMtr - r.soldMtr) * 100) / 100;
    return { ...r, balanceMtr: balance, stockValue: Math.round(balance * r.costPerMtr), totalCost: Math.round(r.purchaseMtr * r.costPerMtr) };
  });
}

/** For people without the "costs" permission: cost price, stock value and capital source never leave the server. */
export function withoutFabricCosts<T extends { costPerMtr: number; openingCostPerMtr?: number | null; stockValue: number; totalCost: number; broughtInBy?: string | null }>(rows: T[]): T[] {
  return rows.map((r) => ({ ...r, costPerMtr: 0, openingCostPerMtr: null, stockValue: 0, totalCost: 0, broughtInBy: null }));
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
  // Tailor is per item: each line with who has it (null = not given out yet)
  // wearer: whose garment, only when it is not the customer themself (Self → null)
  // Whose garment (Wearers) — a plain null until the database has it
  const feat = await features();
  const wearerName = feat.wearers
    ? sql`(select case when "wearers"."is_self" then null else "wearers"."name" end from "wearers" where "wearers"."id" = "order_items"."wearer_id")`
    : sql`null`;
  const variantCol = feat.variant ? sql`"order_items"."variant"` : sql`null`;
  const itemTailors = sql<{ item: string; qty: number; tailorId: number | null; tailor: string | null; wearer: string | null; variant: string | null }[]>`coalesce((select json_agg(json_build_object('item', ${c(orderItems.item)}, 'qty', ${c(orderItems.qty)}, 'tailorId', ${c(orderItems.tailorId)}, 'tailor', (select ${c(staff.name)} from ${staff} where ${c(staff.id)} = ${c(orderItems.tailorId)}), 'wearer', ${wearerName}, 'variant', ${variantCol}) order by ${c(orderItems.id)}) from ${orderItems} where ${c(orderItems.orderId)} = ${c(orders.id)}), '[]'::json)`;
  const pieces = sql<number>`coalesce((select sum(${c(orderItems.qty)}) from ${orderItems} where ${c(orderItems.orderId)} = ${c(orders.id)}),0)`.mapWith(Number);
  const itemNames = sql<string>`coalesce((select string_agg(distinct ${c(orderItems.item)}, ', ') from ${orderItems} where ${c(orderItems.orderId)} = ${c(orders.id)}),'')`;
  const altPhone = sql<string | null>`(select ${c(schema.customers.altPhone)} from ${schema.customers} where ${c(schema.customers.id)} = ${c(orders.customerId)})`;
  const rows = await db
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      date: orders.date,
      customerId: orders.customerId,
      customerName: orders.customerName,
      phone: orders.phone,
      altPhone,
      workType: orders.workType,
      urgency: orders.urgency,
      trialDate: orders.trialDate,
      deliveryDate: orders.deliveryDate,
      status: orders.status,
      itemTailors,
      total: orders.total,
      paid,
      items: itemsSummary,
      itemNames,
      pieces,
      deliveredOn: orders.deliveredOn,
    })
    .from(orders)
    .where(where)
    .orderBy(desc(orders.id));
  return rows.map((r) => {
    const lines = (typeof r.itemTailors === "string" ? JSON.parse(r.itemTailors) : r.itemTailors) as { item: string; qty: number; tailorId: number | null; tailor: string | null; wearer: string | null; variant: string | null }[];
    return { ...r, itemTailors: lines, tailorName: tailorSummary(lines), balance: Math.round((r.total - r.paid) * 100) / 100 };
  });
}

/** "Shamshu (Shirt), Mujeeb (Pant)" — who has which items; null when no item is given out yet. */
export function tailorSummary(lines: { item: string; tailor: string | null }[]) {
  const by = new Map<string, string[]>();
  for (const l of lines) by.set(l.tailor ?? "Not assigned", [...new Set([...(by.get(l.tailor ?? "Not assigned") ?? []), l.item])]);
  if (![...by.keys()].some((k) => k !== "Not assigned")) return null;
  return [...by.entries()].map(([t, its]) => `${t} (${its.join(", ")})`).join(", ");
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
  const rows = await db
    .select({ item: saleItems, photos: fabrics.photoUrls })
    .from(saleItems)
    .leftJoin(fabrics, eq(fabrics.id, saleItems.fabricId))
    .where(eq(saleItems.saleId, id))
    .orderBy(asc(saleItems.id));
  const items = rows.map((r) => ({ ...r.item, photos: r.photos ?? [] }));
  const [seller] = sale.soldById ? await db.select({ name: staff.name }).from(staff).where(eq(staff.id, sale.soldById)) : [];
  const [order] = sale.orderId
    ? await db
        .select({ id: orders.id, orderNo: orders.orderNo, deliveryDate: orders.deliveryDate, urgency: orders.urgency, total: orders.total })
        .from(orders)
        .where(eq(orders.id, sale.orderId))
    : [];
  return { ...sale, items, soldByName: seller?.name ?? null, order: order ?? null };
}

export async function getOrderFull(id: number) {
  const db = await getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, id));
  if (!order) return null;
  const { wearers: hasWearers, variant: hasVariant } = await features();
  const items = await db
    .select({ ...getTableColumns(orderItems), wearerId: when(hasWearers, col.orderItemWearer), variant: when(hasVariant, col.orderItemVariant) })
    .from(orderItems)
    .where(eq(orderItems.orderId, id))
    .orderBy(asc(orderItems.id));
  const pays = await db.select().from(payments).where(eq(payments.orderId, id)).orderBy(asc(payments.id));
  const itemTailorIds = [...new Set(items.map((i) => i.tailorId).filter((x): x is number => !!x))];
  const itemPeople = itemTailorIds.length ? await db.select({ id: staff.id, name: staff.name }).from(staff).where(inArray(staff.id, itemTailorIds)) : [];
  const wearerIds = [...new Set(items.map((i) => i.wearerId).filter((x): x is number => !!x))];
  const itemWearers = wearerIds.length && hasWearers
    ? await db
        .select({ id: schema.wearers.id, name: schema.wearers.name, relation: schema.wearers.relation, school: schema.wearers.school, isSelf: schema.wearers.isSelf })
        .from(schema.wearers)
        .where(inArray(schema.wearers.id, wearerIds))
    : [];
  // Which fabric each garment is cut from (fabric requirement) — none before that database update
  const fabricOf = new Map<number, number>();
  if (items.length && (await features()).itemFabric)
    for (const r of await db
      .select({ itemId: schema.orderItemFabrics.orderItemId, fabricId: schema.orderItemFabrics.fabricId })
      .from(schema.orderItemFabrics)
      .where(inArray(schema.orderItemFabrics.orderItemId, items.map((i) => i.id))))
      fabricOf.set(r.itemId, r.fabricId);
  const itemsWithTailor = items.map((i) => {
    const w = itemWearers.find((x) => x.id === i.wearerId) ?? null;
    // wearerName: whose garment, as printed for the tailor (Self = the customer's own name)
    return { ...i, fabricId: fabricOf.get(i.id) ?? null, tailor: itemPeople.find((p) => p.id === i.tailorId)?.name ?? null, wearer: w, wearerName: w ? (w.isSelf ? (order.customerName ?? "Self") : w.name) : null };
  });
  const ids = [order.tailorId, order.broughtById].filter(Boolean) as number[];
  const people = ids.length ? await db.select({ id: staff.id, name: staff.name }).from(staff).where(inArray(staff.id, ids)) : [];
  const sale = order.saleId ? await getSaleFull(order.saleId) : null;
  const paid = pays.reduce((s, p) => s + p.amount, 0);
  return {
    ...order,
    items: itemsWithTailor,
    /** More than one person's garments in this order (or someone other than Self) — show whose each item is. */
    showWearers: itemWearers.some((w) => !w.isSelf),
    payments: pays,
    sale,
    tailorName: tailorSummary(itemsWithTailor),
    broughtByName: people.find((p) => p.id === order.broughtById)?.name ?? null,
    paid,
    balance: Math.round((order.total - paid) * 100) / 100,
  };
}
export type OrderFull = NonNullable<Awaited<ReturnType<typeof getOrderFull>>>;

/* ───────────── Phase 3 ───────────── */

export async function bulkList() {
  const db = await getDb();
  const { bulkOrders, bulkOrderItems } = schema;
  const paid = sql<number>`coalesce((select sum(${c(payments.amount)}) from ${payments} where ${c(payments.bulkOrderId)} = ${c(bulkOrders.id)}),0)`.mapWith(Number);
  const pieces = sql<number>`coalesce((select sum(${c(bulkOrderItems.qty)}) from ${bulkOrderItems} where ${c(bulkOrderItems.bulkOrderId)} = ${c(bulkOrders.id)}),0)`.mapWith(Number);
  const items = sql<string>`coalesce((select string_agg(distinct ${c(bulkOrderItems.item)}, ', ') from ${bulkOrderItems} where ${c(bulkOrderItems.bulkOrderId)} = ${c(bulkOrders.id)}),'')`;
  const brought = sql<string | null>`(select ${c(staff.name)} from ${staff} where ${c(staff.id)} = ${c(bulkOrders.broughtById)})`;
  const rows = await db
    .select({
      id: bulkOrders.id,
      orderNo: bulkOrders.orderNo,
      date: bulkOrders.date,
      institution: bulkOrders.institution,
      contactPerson: bulkOrders.contactPerson,
      phone: bulkOrders.phone,
      deliveryDate: bulkOrders.deliveryDate,
      status: bulkOrders.status,
      total: bulkOrders.total,
      paid,
      pieces,
      items,
      broughtBy: brought,
    })
    .from(bulkOrders)
    .orderBy(desc(bulkOrders.id));
  return rows.map((r) => ({ ...r, balance: Math.round((r.total - r.paid) * 100) / 100 }));
}
export type BulkRow = Awaited<ReturnType<typeof bulkList>>[number];

export async function getBulkFull(id: number) {
  const db = await getDb();
  const [o] = await db.select().from(schema.bulkOrders).where(eq(schema.bulkOrders.id, id));
  if (!o) return null;
  const items = await db.select().from(schema.bulkOrderItems).where(eq(schema.bulkOrderItems.bulkOrderId, id)).orderBy(asc(schema.bulkOrderItems.id));
  const pays = await db.select().from(payments).where(eq(payments.bulkOrderId, id)).orderBy(asc(payments.id));
  const [b] = o.broughtById ? await db.select({ name: staff.name }).from(staff).where(eq(staff.id, o.broughtById)) : [];
  const paid = pays.reduce((s, p) => s + p.amount, 0);
  return { ...o, items, payments: pays, broughtByName: b?.name ?? null, paid, balance: Math.round((o.total - paid) * 100) / 100 };
}
export type BulkFull = NonNullable<Awaited<ReturnType<typeof getBulkFull>>>;

export async function suppliersWithBalance() {
  const db = await getDb();
  const { suppliers, purchases, supplierPayments, setupExpenses } = schema;
  const billed = sql<number>`coalesce((select sum(${c(purchases.total)}) from ${purchases} where ${c(purchases.supplierId)} = ${c(suppliers.id)}),0)`.mapWith(Number);
  const paidAtBill = sql<number>`coalesce((select sum(${c(purchases.paid)}) from ${purchases} where ${c(purchases.supplierId)} = ${c(suppliers.id)}),0)`.mapWith(Number);
  const paidLater = sql<number>`coalesce((select sum(${c(supplierPayments.amount)}) from ${supplierPayments} where ${c(supplierPayments.supplierId)} = ${c(suppliers.id)}),0)`.mapWith(Number);
  // Setup expenses belong to a supplier when linked, or when "Paid To" contains the supplier's name
  const setupMatch = sql`(${c(setupExpenses.supplierId)} = ${c(suppliers.id)} or (${c(setupExpenses.supplierId)} is null and ${c(setupExpenses.paidTo)} ilike '%' || trim(split_part(${c(suppliers.name)}, '(', 1)) || '%'))`;
  const setupPaid = sql<number>`coalesce((select sum(${c(setupExpenses.amount)}) from ${setupExpenses} where ${setupMatch} and coalesce(${c(setupExpenses.mode)}, '') <> 'Credit (Due)'),0)`.mapWith(Number);
  const setupCredit = sql<number>`coalesce((select sum(${c(setupExpenses.amount)}) from ${setupExpenses} where ${setupMatch} and ${c(setupExpenses.mode)} = 'Credit (Due)'),0)`.mapWith(Number);
  const lastPaid = sql<string | null>`greatest(
    (select max(${c(supplierPayments.date)}) from ${supplierPayments} where ${c(supplierPayments.supplierId)} = ${c(suppliers.id)}),
    (select max(${c(purchases.date)}) from ${purchases} where ${c(purchases.supplierId)} = ${c(suppliers.id)} and ${c(purchases.paid)} > 0)
  )`;
  const lastMode = sql<string | null>`(select ${c(supplierPayments.mode)} from ${supplierPayments} where ${c(supplierPayments.supplierId)} = ${c(suppliers.id)} order by ${c(supplierPayments.date)} desc, ${c(supplierPayments.id)} desc limit 1)`;
  const rows = await db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      type: suppliers.type,
      place: suppliers.place,
      phone: suppliers.phone,
      upi: suppliers.upi,
      bank: suppliers.bank,
      gstNo: suppliers.gstNo,
      supplies: suppliers.supplies,
      aliases: suppliers.aliases,
      openingBalance: suppliers.openingBalance,
      notes: suppliers.notes,
      billed,
      paidAtBill,
      paidLater,
      setupPaid,
      setupCredit,
      lastPaid,
      lastMode,
    })
    .from(suppliers)
    .orderBy(asc(suppliers.name));
  // Owed = opening balance + fabric purchases + setup goods taken on credit ("Credit (Due)" only)
  // Balance = owed − (paid at purchase + payments on account)
  return rows.map((r) => {
    const opening = Number(r.openingBalance) || 0;
    const owed = opening + r.billed + r.setupCredit;
    return {
      ...r,
      openingBalance: opening,
      owed: Math.round(owed * 100) / 100,
      paid: Math.round((r.paidAtBill + r.paidLater) * 100) / 100,
      balance: Math.round((owed - r.paidAtBill - r.paidLater) * 100) / 100,
    };
  });
}
export type SupplierRow = Awaited<ReturnType<typeof suppliersWithBalance>>[number];

/** Suppliers we still owe money to, largest first, plus the total (the "Balance to pay" figure). */
export async function supplierDues() {
  const rows = await suppliersWithBalance();
  const due = rows
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name))
    .map((r) => ({ id: r.id, name: r.name, supplies: r.supplies, balance: r.balance, lastPaid: r.lastPaid, lastMode: r.lastMode, phone: r.phone, upi: r.upi, bank: r.bank }));
  const total = Math.round(due.reduce((s, r) => s + r.balance, 0) * 100) / 100;
  return { rows: due, total, all: rows };
}
export type SupplierDue = Awaited<ReturnType<typeof supplierDues>>["rows"][number];

export async function purchasesList() {
  const db = await getDb();
  const { purchases, suppliers } = schema;
  return db
    .select({
      id: purchases.id,
      date: purchases.date,
      supplierId: purchases.supplierId,
      supplierName: suppliers.name,
      invoiceNo: purchases.invoiceNo,
      description: purchases.description,
      qty: purchases.qty,
      rate: purchases.rate,
      taxable: purchases.taxable,
      gstPct: purchases.gstPct,
      gstAmount: purchases.gstAmount,
      total: purchases.total,
      paid: purchases.paid,
      remarks: purchases.remarks,
    })
    .from(purchases)
    .leftJoin(suppliers, eq(suppliers.id, purchases.supplierId))
    .orderBy(desc(purchases.date), desc(purchases.id));
}
export type PurchaseRow = Awaited<ReturnType<typeof purchasesList>>[number];

export async function cashBookRows() {
  const db = await getDb();
  return db.select().from(schema.cashBook).orderBy(asc(schema.cashBook.date), asc(schema.cashBook.id));
}
export type CashRow = Awaited<ReturnType<typeof cashBookRows>>[number];
