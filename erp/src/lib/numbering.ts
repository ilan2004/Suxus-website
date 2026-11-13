import "server-only";
import { sql } from "drizzle-orm";
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
