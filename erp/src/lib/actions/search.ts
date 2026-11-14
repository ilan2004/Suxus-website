"use server";

import { desc, ilike, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export type SearchHit = { type: string; label: string; sub: string; href: string; thumb?: string | null };

/** One search box for everything: customers, bills, orders, bulk orders, fabrics, suppliers, staff. */
export async function globalSearch(q: string): Promise<SearchHit[]> {
  const user = await requireUser();
  const term = q.trim();
  if (term.length < 2) return [];
  const like = `%${term}%`;
  const digits = term.replace(/\D/g, "");
  const db = await getDb();
  const s = schema;
  const [customers, sales, orders, bulk, fabrics, suppliers, staff] = await Promise.all([
    db
      .select({ id: s.customers.id, name: s.customers.name, phone: s.customers.phone, code: s.customers.code, place: s.customers.place })
      .from(s.customers)
      .where(or(ilike(s.customers.name, like), ilike(s.customers.code, like), digits.length >= 4 ? ilike(s.customers.phone, `%${digits}%`) : sql`false`))
      .limit(6),
    db
      .select({ id: s.sales.id, billNo: s.sales.billNo, name: s.sales.customerName, net: s.sales.net, date: s.sales.date })
      .from(s.sales)
      .where(or(ilike(s.sales.billNo, like), ilike(s.sales.customerName, like), digits.length >= 4 ? ilike(s.sales.phone, `%${digits}%`) : sql`false`))
      .orderBy(desc(s.sales.id))
      .limit(5),
    db
      .select({ id: s.orders.id, orderNo: s.orders.orderNo, name: s.orders.customerName, status: s.orders.status, total: s.orders.total })
      .from(s.orders)
      .where(or(ilike(s.orders.orderNo, like), ilike(s.orders.customerName, like), digits.length >= 4 ? ilike(s.orders.phone, `%${digits}%`) : sql`false`))
      .orderBy(desc(s.orders.id))
      .limit(5),
    db
      .select({ id: s.bulkOrders.id, orderNo: s.bulkOrders.orderNo, name: s.bulkOrders.institution, status: s.bulkOrders.status })
      .from(s.bulkOrders)
      .where(or(ilike(s.bulkOrders.orderNo, like), ilike(s.bulkOrders.institution, like)))
      .orderBy(desc(s.bulkOrders.id))
      .limit(4),
    db
      .select({ id: s.fabrics.id, code: s.fabrics.code, brand: s.fabrics.brand, shade: s.fabrics.shade, thumb: s.fabrics.thumbnailUrl })
      .from(s.fabrics)
      .where(or(ilike(s.fabrics.code, like), ilike(s.fabrics.brand, like), ilike(s.fabrics.shade, like), ilike(s.fabrics.barcode, like)))
      .limit(5),
    db
      .select({ id: s.suppliers.id, name: s.suppliers.name, aliases: s.suppliers.aliases, supplies: s.suppliers.supplies })
      .from(s.suppliers)
      .where(or(ilike(s.suppliers.name, like), ilike(s.suppliers.aliases, like), ilike(s.suppliers.supplies, like)))
      .limit(5),
    user.role === "partner"
      ? db.select({ id: s.staff.id, name: s.staff.name, role: s.staff.role }).from(s.staff).where(ilike(s.staff.name, like)).limit(4)
      : Promise.resolve([]),
  ]);
  const rs = (n: number) => "₹" + new Intl.NumberFormat("en-IN").format(Math.round(n));
  return [
    ...customers.map((c) => ({ type: "Customer", label: c.name, sub: [c.code, c.phone, c.place].filter(Boolean).join(" · "), href: `/customers/${c.id}` })),
    ...orders.map((o) => ({ type: "Order", label: `${o.orderNo} · ${o.name ?? ""}`, sub: `${o.status} · ${rs(o.total)}`, href: `/orders/${o.id}` })),
    ...sales.map((x) => ({ type: "Bill", label: `${x.billNo} · ${x.name ?? "Walk-in"}`, sub: `${x.date} · ${rs(x.net)}`, href: `/sales/${x.id}` })),
    ...bulk.map((b) => ({ type: "Bulk order", label: `${b.orderNo} · ${b.name}`, sub: b.status, href: `/bulk/${b.id}` })),
    ...fabrics.map((f) => ({ type: "Fabric", label: `${f.code} · ${f.brand}`, sub: f.shade ?? "", href: `/fabrics/${f.id}`, thumb: f.thumb })),
    ...suppliers.map((x) => ({ type: "Supplier", label: x.name, sub: [x.aliases && `aka ${x.aliases}`, x.supplies].filter(Boolean).join(" · "), href: `/suppliers/${x.id}` })),
    ...staff.map((x) => ({ type: "Staff", label: x.name, sub: x.role ?? "", href: `/staff/${x.id}` })),
  ];
}
