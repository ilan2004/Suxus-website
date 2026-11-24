import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { col, when } from "./db/ext";
import { features } from "./db/features";
import { getSetting } from "./settings";
import { fabricsWithStock } from "./queries";
import { fabricRequirement, measureFor, type ReqMeasure, type Requirement } from "./fabric-requirement";
export type { ReqMeasure } from "./fabric-requirement";


/** The latest record per person and garment for a customer (records from before Wearers count as Self). */
export async function latestMeasurements(customerId: number): Promise<{ measures: ReqMeasure[]; selfId: number | null }> {
  const db = await getDb();
  const { wearers } = await features();
  const rows = await db
    .select({ wearerId: when(wearers, col.measurementWearer), garmentType: schema.measurements.garmentType, values: schema.measurements.values, fit: schema.measurements.fit, date: schema.measurements.date })
    .from(schema.measurements)
    .where(eq(schema.measurements.customerId, customerId))
    .orderBy(desc(schema.measurements.date), desc(schema.measurements.id));
  const selfId = wearers
    ? ((await db.select({ id: schema.wearers.id }).from(schema.wearers).where(and(eq(schema.wearers.customerId, customerId), eq(schema.wearers.isSelf, true))))[0]?.id ?? null)
    : null;
  const seen = new Set<string>();
  const measures: ReqMeasure[] = [];
  for (const r of rows) {
    const k = `${r.wearerId ?? selfId}|${r.garmentType}`;
    if (seen.has(k)) continue;
    seen.add(k);
    measures.push({ ...r, wearerId: r.wearerId ?? selfId });
  }
  return { measures, selfId };
}

export type FabricLite = { id: number; code: string; name: string; hex: string | null };
export type OrderFabricPlan = {
  items: Record<number, { req: Requirement | null; fabric: FabricLite | null }>;
  /** per fabric: metres needed by this order's garments, metres available (stock + what this order's bill already took) */
  totals: { fabric: FabricLite; need: number; available: number; garments: number; short: boolean }[];
};

/**
 * The fabric requirement of every garment on an order, and the total per fabric against what is available.
 * An estimate only — stock is reduced by the bill, never by this.
 */
export async function orderFabricPlan(order: {
  customerId: number | null;
  sale: { cancelled: boolean; items: { fabricId: number | null; metres: number }[] } | null;
  items: { id: number; item: string; qty: number; wearerId?: number | null; fabricId?: number | null }[];
}): Promise<OrderFabricPlan> {
  const tables = await getSetting("fabricRequirement");
  const { measures, selfId } = order.customerId ? await latestMeasurements(order.customerId) : { measures: [], selfId: null };
  const stock = await fabricsWithStock();
  const lite = (id: number | null | undefined): FabricLite | null => {
    const f = id ? stock.find((x) => x.id === id) : null;
    return f ? { id: f.id, code: f.code, name: [f.brand, f.shade].filter(Boolean).join(" · "), hex: f.dominantHex } : null;
  };
  // Metres of each fabric on this order's own bill: already off the stock balance, but set aside for this order
  const billed = new Map<number, number>();
  if (order.sale && !order.sale.cancelled) for (const s of order.sale.items) if (s.fabricId) billed.set(s.fabricId, (billed.get(s.fabricId) ?? 0) + s.metres);
  // A garment with no fabric of its own: the bill's fabric when the bill has just one
  const onlyBillFabric = billed.size === 1 ? [...billed.keys()][0] : null;

  const items: OrderFabricPlan["items"] = {};
  const sums = new Map<number, { need: number; garments: number }>();
  for (const i of order.items) {
    const m = measureFor(measures, i.item, i.wearerId ?? null, selfId);
    const req = fabricRequirement(tables, i.item, i.qty, m);
    const fabric = lite(i.fabricId ?? onlyBillFabric);
    items[i.id] = { req, fabric };
    if (fabric && req?.ok) {
      const s = sums.get(fabric.id) ?? { need: 0, garments: 0 };
      s.need += req.total;
      s.garments += i.qty;
      sums.set(fabric.id, s);
    }
  }
  const totals = [...sums.entries()].map(([id, s]) => {
    const f = stock.find((x) => x.id === id)!;
    const available = Math.round(((f.balanceMtr ?? 0) + (billed.get(id) ?? 0)) * 100) / 100;
    const need = Math.round(s.need * 100) / 100;
    return { fabric: lite(id)!, need, available, garments: s.garments, short: available < need };
  });
  return { items, totals };
}

/** order_item_fabrics for some items (empty before that database update). */
export async function itemFabricIds(itemIds: number[]): Promise<Map<number, number>> {
  if (!itemIds.length || !(await features()).itemFabric) return new Map();
  const db = await getDb();
  const rows = await db
    .select({ itemId: schema.orderItemFabrics.orderItemId, fabricId: schema.orderItemFabrics.fabricId })
    .from(schema.orderItemFabrics)
    .where(sql`${schema.orderItemFabrics.orderItemId} in ${itemIds}`);
  return new Map(rows.map((r) => [r.itemId, r.fabricId]));
}
