import "server-only";
import { openingClothValue } from "./db/ext";
import { features } from "./db/features";
import { and, eq, gte, isNull, lte, ne, notInArray, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { getDb, schema } from "./db";
import { c } from "./db/sql";
import { getSettings } from "./settings";
import { fabricsWithStock } from "./queries";

const { sales, saleItems, orders, payments, bulkOrders, purchases, supplierPayments, tailorWages, wagePayments, incentivePayouts, cashBook, setupExpenses, openingStock, staff, fabrics } = schema;
const num = (s: SQL) => sql<number>`coalesce(${s}, 0)`.mapWith(Number);
const r2 = (n: number) => Math.round(n * 100) / 100;

/* ───────────── Incentive (same rules as the "Incentive" sheet) ───────────── */

export function slabRate(collected: number, slabs: { from: number; to: number; rate: number }[]) {
  // Excel: MATCH(collected, From column, 1) → the last slab whose "From" ≤ collected
  const sorted = [...slabs].sort((a, b) => a.from - b.from);
  let rate = 0;
  for (const s of sorted) if (collected >= s.from) rate = s.rate;
  return rate;
}

export async function incentiveFor(from: string, to: string) {
  const db = await getDb();
  const settings = await getSettings();
  const people = await db.select().from(staff).where(eq(staff.status, "Active")).orderBy(staff.code);
  const inRange = (col: AnyColumn) => and(gte(col, from), lte(col, to));

  const out = [];
  for (const p of people) {
    const [st] = await db
      .select({ v: num(sql`sum(${orders.total})`) })
      .from(orders)
      .where(and(eq(orders.broughtById, p.id), inRange(orders.date), ne(orders.status, "Cancelled")));
    const [bk] = await db
      .select({ v: num(sql`sum(${bulkOrders.total})`) })
      .from(bulkOrders)
      .where(and(eq(bulkOrders.broughtById, p.id), inRange(bulkOrders.date), ne(bulkOrders.status, "Cancelled")));
    const [fs] = await db
      .select({ v: num(sql`sum(${sales.net})`) })
      .from(sales)
      .where(and(eq(sales.soldById, p.id), inRange(sales.date), eq(sales.cancelled, false), eq(sales.stitchingHere, false)));
    // Collection (money actually received in the period) — the base for incentive
    const [colOrders] = await db
      .select({ v: num(sql`sum(${payments.amount})`) })
      .from(payments)
      .where(and(gte(payments.date, from), lte(payments.date, to), sql`${c(payments.orderId)} in (select ${c(orders.id)} from ${orders} where ${c(orders.broughtById)} = ${p.id})`));
    const [colBulk] = await db
      .select({ v: num(sql`sum(${payments.amount})`) })
      .from(payments)
      .where(and(gte(payments.date, from), lte(payments.date, to), sql`${c(payments.bulkOrderId)} in (select ${c(bulkOrders.id)} from ${bulkOrders} where ${c(bulkOrders.broughtById)} = ${p.id})`));
    const [colFabric] = await db
      .select({ v: num(sql`sum(${sales.net})`) })
      .from(sales)
      .where(and(eq(sales.soldById, p.id), inRange(sales.date), eq(sales.cancelled, false), eq(sales.stitchingHere, false), ne(sales.paymentMode, "Credit (Due)")));
    const [rec] = await db
      .select()
      .from(incentivePayouts)
      .where(and(eq(incentivePayouts.staffId, p.id), eq(incentivePayouts.fromDate, from), eq(incentivePayouts.toDate, to)));

    const business = r2(st.v + bk.v + fs.v);
    const collected = r2(colOrders.v + colBulk.v + colFabric.v);
    const own = p.ownIncentivePct ?? 0;
    const rate = own > 0 ? own : slabRate(collected, settings.slabs);
    out.push({
      staffId: p.id,
      name: p.name,
      role: p.role,
      eligible: p.incentive || own > 0,
      ownRate: own > 0,
      stitching: st.v,
      bulk: bk.v,
      fabric: fs.v,
      business,
      collected,
      rate,
      incentive: r2(collected * rate),
      record: rec ?? null,
    });
  }
  return out;
}
export type IncentiveRow = Awaited<ReturnType<typeof incentiveFor>>[number];

/* ───────────── Capital account (same as the "Capital Account" sheet) ───────────── */

export async function capitalAccount() {
  const db = await getDb();
  const { partner: partners } = (await getSettings()).lists;
  const names = partners.filter((p) => p !== "Business Account");
  const rows = [];
  for (const name of names) {
    const [setup] = await db.select({ v: num(sql`sum(${setupExpenses.amount})`) }).from(setupExpenses).where(eq(setupExpenses.paidBy, name));
    const [assets] = await db
      .select({ v: num(sql`sum(${openingStock.qty} * ${openingStock.unitValue})`) })
      .from(openingStock)
      .where(eq(openingStock.ownedBy, name));
    // fabric rolls marked "brought in by" this partner in Fabric Stock (value at cost when brought in)
    const [cloth] = await db
      .select({ v: num(openingClothValue((await features()).stock)) })
      .from(fabrics)
      .where(eq(fabrics.broughtInBy, name));
    const stock = { v: r2(assets.v + cloth.v) };
    const [capital] = await db
      .select({ v: num(sql`sum(${cashBook.amountIn})`) })
      .from(cashBook)
      .where(and(eq(cashBook.category, "Capital Introduced"), eq(cashBook.partner, name)));
    const [drawn] = await db
      .select({ v: num(sql`sum(${cashBook.amountOut})`) })
      .from(cashBook)
      .where(and(eq(cashBook.category, "Owner Withdrawal"), eq(cashBook.partner, name)));
    rows.push({ name, setup: setup.v, stock: stock.v, capital: capital.v, total: r2(setup.v + stock.v + capital.v), withdrawn: drawn.v });
  }
  const grand = rows.reduce((s, r) => s + r.total, 0);
  return rows.map((r) => ({ ...r, share: grand > 0 ? r.total / grand : 0, net: r2(r.total - r.withdrawn) }));
}
export type CapitalRow = Awaited<ReturnType<typeof capitalAccount>>[number];

/* ───────────── Summary (same as the "Summary" sheet, plus a few extras) ───────────── */

export async function summary(from: string, to: string) {
  const db = await getDb();
  const between = (col: AnyColumn) => and(gte(col, from), lte(col, to));
  const one = async (q: Promise<{ v: number }[]>) => (await q)[0]?.v ?? 0;

  const fabricSales = await one(
    db.select({ v: num(sql`sum(${sales.net})`) }).from(sales).where(and(between(sales.date), eq(sales.cancelled, false), eq(sales.stitchingHere, false))),
  );
  const metres = await one(
    db
      .select({ v: num(sql`sum(${saleItems.metres})`) })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(and(between(sales.date), eq(sales.cancelled, false))),
  );
  const byWork = async (w: string) =>
    one(db.select({ v: num(sql`sum(${orders.total})`) }).from(orders).where(and(between(orders.date), eq(orders.workType, w), ne(orders.status, "Cancelled"))));
  const shopStitch = await byWork("Shop Fabric Stitching");
  const outsideStitch = await byWork("Outside Fabric Stitching");
  const alteration = await byWork("Alteration");
  const bulk = await one(db.select({ v: num(sql`sum(${bulkOrders.total})`) }).from(bulkOrders).where(and(between(bulkOrders.date), ne(bulkOrders.status, "Cancelled"))));
  const income = r2(fabricSales + shopStitch + outsideStitch + alteration + bulk);

  const purchaseTotal = await one(db.select({ v: num(sql`sum(${purchases.total})`) }).from(purchases).where(between(purchases.date)));
  const wages = await one(db.select({ v: num(sql`sum(${tailorWages.amount})`) }).from(tailorWages).where(between(tailorWages.date)));
  const incentive = await one(db.select({ v: num(sql`sum(${incentivePayouts.incentive})`) }).from(incentivePayouts).where(between(incentivePayouts.fromDate)));
  // Manual cash-book expenses only (automatic entries are already counted above); capital movements excluded
  const otherExpenses = await one(
    db
      .select({ v: num(sql`sum(${cashBook.amountOut})`) })
      .from(cashBook)
      .where(and(between(cashBook.date), isNull(cashBook.source), notInArray(cashBook.category, ["Owner Withdrawal", "Capital Introduced"]))),
  );
  const expenseByCat = await db
    .select({ category: cashBook.category, v: num(sql`sum(${cashBook.amountOut})`) })
    .from(cashBook)
    .where(and(between(cashBook.date), isNull(cashBook.source), notInArray(cashBook.category, ["Owner Withdrawal", "Capital Introduced"])))
    .groupBy(cashBook.category);
  const expenses = r2(purchaseTotal + wages + incentive + otherExpenses);

  const cashIn = await one(db.select({ v: num(sql`sum(${cashBook.amountIn})`) }).from(cashBook).where(between(cashBook.date)));
  const cashOut = await one(db.select({ v: num(sql`sum(${cashBook.amountOut})`) }).from(cashBook).where(between(cashBook.date)));

  // Setup (all time, like the Excel)
  const setupTotal = await one(db.select({ v: num(sql`sum(${setupExpenses.amount})`) }).from(setupExpenses));
  const setupBy = await db
    .select({ paidBy: setupExpenses.paidBy, v: num(sql`sum(${setupExpenses.amount})`) })
    .from(setupExpenses)
    .groupBy(setupExpenses.paidBy);

  // Pending (as of now)
  const custStitch = await one(
    db
      .select({ v: num(sql`sum(${orders.total} - coalesce((select sum(${c(payments.amount)}) from ${payments} where ${c(payments.orderId)} = ${c(orders.id)}),0))`) })
      .from(orders)
      .where(ne(orders.status, "Cancelled")),
  );
  const custBulk = await one(
    db
      .select({ v: num(sql`sum(${bulkOrders.total} - coalesce((select sum(${c(payments.amount)}) from ${payments} where ${c(payments.bulkOrderId)} = ${c(bulkOrders.id)}),0))`) })
      .from(bulkOrders)
      .where(ne(bulkOrders.status, "Cancelled")),
  );
  const supplierBal = r2(
    (await one(db.select({ v: num(sql`sum(${purchases.total} - ${purchases.paid})`) }).from(purchases))) -
      (await one(db.select({ v: num(sql`sum(${supplierPayments.amount})`) }).from(supplierPayments))),
  );
  const wageBal = r2(
    (await one(db.select({ v: num(sql`sum(${tailorWages.amount} - ${tailorWages.paid})`) }).from(tailorWages))) -
      (await one(db.select({ v: num(sql`sum(${wagePayments.amount})`) }).from(wagePayments))),
  );
  const incentiveBal = await one(db.select({ v: num(sql`sum(${incentivePayouts.incentive} - ${incentivePayouts.paid})`) }).from(incentivePayouts));

  const fabrics = (await fabricsWithStock()).filter((f) => f.active);
  const openingValue = r2(
    (await one(db.select({ v: num(sql`sum(${openingStock.qty} * ${openingStock.unitValue})`) }).from(openingStock))) +
      (await one(db.select({ v: num(openingClothValue((await features()).stock)) }).from(schema.fabrics).where(sql`${schema.fabrics.broughtInBy} is not null`))),
  );
  const capital = await capitalAccount();

  return {
    from,
    to,
    income: { fabricSales, metres, shopStitch, outsideStitch, alteration, bulk, total: income },
    expenses: { purchases: purchaseTotal, wages, incentive, other: otherExpenses, byCategory: expenseByCat.filter((e) => e.v > 0), total: expenses },
    surplus: r2(income - expenses),
    cash: { in: cashIn, out: cashOut, net: r2(cashIn - cashOut) },
    setup: { total: setupTotal, byPartner: setupBy },
    pending: { stitching: custStitch, bulk: custBulk, suppliers: supplierBal, wages: wageBal, incentive: incentiveBal },
    stock: {
      metres: r2(fabrics.reduce((s, f) => s + f.balanceMtr, 0)),
      value: r2(fabrics.reduce((s, f) => s + f.stockValue, 0)),
      opening: openingValue,
    },
    capital,
  };
}
export type Summary = Awaited<ReturnType<typeof summary>>;
