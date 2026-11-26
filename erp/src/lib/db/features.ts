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
 */
export type Features = { stock: boolean; wearers: boolean; simple: boolean; jobSlip: boolean };

const NEEDS: Record<keyof Features, string[]> = {
  stock: ["fabrics.opening_mtr", "fabrics.opening_cost_per_mtr", "fabric_stock_moves.id"],
  wearers: ["wearers.id", "measurements.wearer_id", "order_items.wearer_id"],
  simple: ["staff.simple_mode", "measurement_drafts.id"],
  jobSlip: ["job_slip_links.token", "job_slip_events.id"],
};

const g = globalThis as unknown as { __suxusFeatures?: { at: number; f: Features } };

export async function features(): Promise<Features> {
  const c = g.__suxusFeatures;
  const all = c && Object.values(c.f).every(Boolean);
  if (c && (all || Date.now() - c.at < 60_000)) return c.f;
  let f: Features = { stock: false, wearers: false, simple: false, jobSlip: false };
  try {
    const db = await getDb();
    const res = await db.execute(sql`select table_name || '.' || column_name as k from information_schema.columns where table_schema = current_schema()
      and table_name in ('fabrics', 'fabric_stock_moves', 'wearers', 'measurements', 'order_items', 'staff', 'measurement_drafts', 'job_slip_links', 'job_slip_events')`);
    const rows = (Array.isArray(res) ? res : (res as { rows: unknown[] }).rows) as { k: string }[];
    const have = new Set(rows.map((r) => r.k));
    f = Object.fromEntries(Object.entries(NEEDS).map(([k, cols]) => [k, cols.every((x) => have.has(x))])) as Features;
    // Simple mode keeps drafts per person (wearer); job slips name the person — both build on Wearers
    f.simple = f.simple && f.wearers;
    f.jobSlip = f.jobSlip && f.wearers;
  } catch (e) {
    console.error("[features] check failed — newer features off", e);
  }
  g.__suxusFeatures = { at: Date.now(), f };
  return f;
}
