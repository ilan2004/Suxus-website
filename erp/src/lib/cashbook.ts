import "server-only";
import { and, eq } from "drizzle-orm";
import type { DB, Tx } from "./db";
import { cashBook } from "./db/schema";

/** Automatic cash-book entries for sales, payments, wages … (one per source row). */
export async function postCash(
  db: DB | Tx,
  e: {
    source: string;
    sourceId: number;
    date: string;
    particulars: string;
    category: string;
    amountIn?: number;
    amountOut?: number;
    mode: string;
  },
) {
  if (e.mode === "Credit (Due)" || (!e.amountIn && !e.amountOut)) {
    await removeCash(db, e.source, e.sourceId);
    return;
  }
  const values = {
    date: e.date,
    particulars: e.particulars,
    category: e.category,
    amountIn: e.amountIn ?? 0,
    amountOut: e.amountOut ?? 0,
    mode: e.mode,
    source: e.source,
    sourceId: e.sourceId,
  };
  await db
    .insert(cashBook)
    .values(values)
    .onConflictDoUpdate({ target: [cashBook.source, cashBook.sourceId], set: values });
}

export async function removeCash(db: DB | Tx, source: string, sourceId: number) {
  await db.delete(cashBook).where(and(eq(cashBook.source, source), eq(cashBook.sourceId, sourceId)));
}
