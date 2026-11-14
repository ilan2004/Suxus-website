import "server-only";
import { eq, sql } from "drizzle-orm";
import type { DB, Tx } from "./db";
import { counters } from "./db/schema";

/** Atomically increments and returns the next number for a counter key. */
export async function nextNumber(db: DB | Tx, key: string): Promise<number> {
  const [row] = await db
    .insert(counters)
    .values({ key, value: 1 })
    .onConflictDoUpdate({ target: counters.key, set: { value: sql`${counters.value} + 1` } })
    .returning({ value: counters.value });
  return row.value;
}

export const pad = (n: number, width = 4) => String(n).padStart(width, "0");

export async function nextDocNo(db: DB | Tx, prefix: "FS" | "SO" | "BO" | "C", width = 4) {
  return `${prefix}-${pad(await nextNumber(db, prefix), width)}`;
}

/** After a delete: point the counter at the highest number still in use, so trial numbers are reused (SO-0001 again). */
export async function resetCounterToMax(db: DB | Tx, prefix: "FS" | "SO" | "BO", table: "sales" | "orders" | "bulk_orders", column: "bill_no" | "order_no") {
  const res = await db.execute(
    sql`select coalesce(max(cast(substring(${sql.identifier(column)} from ${prefix.length + 2}) as integer)), 0) as n from ${sql.identifier(table)} where ${sql.identifier(column)} ~ ${"^" + prefix + "-[0-9]+$"}`,
  );
  const rows = (Array.isArray(res) ? res : ((res as unknown as { rows: unknown[] }).rows ?? [])) as { n: number | string }[];
  const n = Number(rows[0]?.n ?? 0);
  await db.update(counters).set({ value: n }).where(eq(counters.key, prefix));
  return n;
}
