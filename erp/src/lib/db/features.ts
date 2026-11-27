import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "./index";

/**
 * Which newer features the database can serve — i.e. which migrations have run. Checked once per server instance
 * (a "yes" never changes back; a "no" is checked again after a minute, so a late migration is picked up).
 *   stock    0019  Add stock / Adjust stock          fabrics.opening_mtr, fabric_stock_moves
 *   wearers  0020  Wearers                           wearers, measurements.wearer_id, order_items.wearer_id
 *   simple   0021  Simple measurement mode           staff.simple_mode, measurement_drafts
 *   jobSlip  0022  Bundle label + job slip PDF       job_slip_links, job_slip_events
 *   itemFabric 0023 Fabric per order item (fabric requirement)   order_item_fabrics
 *   variant  0024  Garment variant on the order item   order_items.variant
 *   prices   0025  Stitching price list               stitching_prices, order_items.list_rate, bulk_order_items.list_rate
 *   pocket   0026  Pocket options on a shirt record   measurements.pocket, measurement_drafts.pocket
 *   tryon    0027  AI fabric try-on                   tryon_images, tryon_generations
 */
export type Features = { stock: boolean; wearers: boolean; simple: boolean; jobSlip: boolean; itemFabric: boolean; variant: boolean; prices: boolean; pocket: boolean; tryon: boolean };

const NEEDS: Record<keyof Features, string[]> = {
  stock: ["fabrics.opening_mtr", "fabrics.opening_cost_per_mtr", "fabric_stock_moves.id"],
  wearers: ["wearers.id", "measurements.wearer_id", "order_items.wearer_id"],
  simple: ["staff.simple_mode", "measurement_drafts.id"],
  jobSlip: ["job_slip_links.token", "job_slip_events.id"],
  itemFabric: ["order_item_fabrics.order_item_id", "order_item_fabrics.fabric_id"],
  variant: ["order_items.variant"],
  prices: ["stitching_prices.id", "order_items.list_rate", "order_items.rate_changed_by", "bulk_order_items.variant", "bulk_order_items.list_rate", "bulk_order_items.rate_changed_by"],
  pocket: ["measurements.pocket", "measurement_drafts.pocket"],
  tryon: ["tryon_images.data", "tryon_generations.cost_usd"],
};

const g = globalThis as unknown as { __suxusFeatures?: { at: number; f: Features } };

export async function features(): Promise<Features> {
  const c = g.__suxusFeatures;
  const all = c && Object.values(c.f).every(Boolean);
  if (c && (all || Date.now() - c.at < 60_000)) return c.f;
  let f: Features = { stock: false, wearers: false, simple: false, jobSlip: false, itemFabric: false, variant: false, prices: false, pocket: false, tryon: false };
  try {
    const db = await getDb();
    const res = await db.execute(sql`select table_name || '.' || column_name as k from information_schema.columns where table_schema = current_schema()
      and table_name in ('fabrics', 'fabric_stock_moves', 'wearers', 'measurements', 'order_items', 'staff', 'measurement_drafts', 'job_slip_links', 'job_slip_events', 'order_item_fabrics', 'stitching_prices', 'bulk_order_items', 'tryon_images', 'tryon_generations')`);
    const rows = (Array.isArray(res) ? res : (res as { rows: unknown[] }).rows) as { k: string }[];
    const have = new Set(rows.map((r) => r.k));
    f = Object.fromEntries(Object.entries(NEEDS).map(([k, cols]) => [k, cols.every((x) => have.has(x))])) as Features;
    // Simple mode keeps drafts per person (wearer); job slips name the person — both build on Wearers
    f.simple = f.simple && f.wearers;
    f.jobSlip = f.jobSlip && f.wearers;
    // prices match garment AND variant
    f.prices = f.prices && f.variant;
  } catch (e) {
    console.error("[features] check failed — newer features off", e);
  }
  g.__suxusFeatures = { at: Date.now(), f };
  return f;
}
