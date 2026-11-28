import "server-only";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { WebOrderItem } from "./web-order";

/** Website orders, newest first (the list page). */
export async function webOrderList() {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.webOrders.id, createdAt: schema.webOrders.createdAt, name: schema.webOrders.name, phone: schema.webOrders.phone, pincode: schema.webOrders.pincode, items: schema.webOrders.items, status: schema.webOrders.status, customerId: schema.webOrders.customerId })
    .from(schema.webOrders)
    .orderBy(desc(schema.webOrders.id))
    .limit(300);
  return rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt).toISOString(), items: r.items as WebOrderItem[] }));
}
export type WebOrderRow = Awaited<ReturnType<typeof webOrderList>>[number];

/** One website order with the fabrics' names and photos. */
export async function webOrder(id: number) {
  const db = await getDb();
  const [o] = await db.select().from(schema.webOrders).where(eq(schema.webOrders.id, id));
  if (!o) return null;
  const items = o.items as WebOrderItem[];
  const codes = [...new Set(items.map((i) => i.fabricCode))];
  const fabrics = codes.length
    ? await db
        .select({ id: schema.fabrics.id, code: schema.fabrics.code, brand: schema.fabrics.brand, shade: schema.fabrics.shade, saleRate: schema.fabrics.saleRate, thumbUrls: schema.fabrics.thumbUrls, photoUrls: schema.fabrics.photoUrls })
        .from(schema.fabrics)
        .where(inArray(schema.fabrics.code, codes))
    : [];
  const byCode = Object.fromEntries(fabrics.map((f) => [f.code, { id: f.id, name: [f.brand, f.shade].filter(Boolean).join(" · "), rate: Number(f.saleRate ?? 0), thumb: (f.thumbUrls as string[] | null)?.[0] ?? (f.photoUrls as string[] | null)?.[0] ?? null }]));
  const customer = o.customerId ? (await db.select({ id: schema.customers.id, code: schema.customers.code, name: schema.customers.name }).from(schema.customers).where(eq(schema.customers.id, o.customerId)))[0] ?? null : null;
  return { ...o, createdAt: new Date(o.createdAt).toISOString(), handledAt: o.handledAt ? new Date(o.handledAt).toISOString() : null, items, fabrics: byCode, customer };
}
export type WebOrderFull = NonNullable<Awaited<ReturnType<typeof webOrder>>>;
