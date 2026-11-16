import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { DB, Tx } from "./db";
import { schema } from "./db";
import { keyAmount, keyText } from "./import-merge";

export type TombEntity = "setup_expense" | "purchase" | "cash_book" | "supplier_payment";

/**
 * Remember deleted rows so that a later Merge import of the Excel book does not add them back.
 * Uses the row's import key, or works out the same key the importer would use (Date + Paid To + Amount #n).
 */
export async function rememberDeleted(db: DB | Tx, entity: TombEntity, ids: number[]) {
  if (!ids.length) return;
  const s = schema;
  const keys: { entryId: string; summary: string }[] = [];
  if (entity === "setup_expense") {
    const all = await db.select().from(s.setupExpenses).orderBy(asc(s.setupExpenses.id));
    const occ = new Map<string, number>();
    for (const r of all) {
      const base = `${r.date}|${keyText(r.paidTo)}|${keyAmount(r.amount)}`;
      const n = (occ.get(base) ?? 0) + 1;
      occ.set(base, n);
      if (ids.includes(r.id)) keys.push({ entryId: r.entryId ?? `${base}#${n}`, summary: `${r.date} ${r.paidTo ?? ""} ₹${r.amount}` });
    }
  } else if (entity === "purchase") {
    const all = await db.select().from(s.purchases).orderBy(asc(s.purchases.id));
    const occ = new Map<string, number>();
    for (const r of all) {
      const base = `${r.date}|${r.supplierId}|${keyAmount(r.total)}`;
      const n = (occ.get(base) ?? 0) + 1;
      occ.set(base, n);
      if (ids.includes(r.id)) keys.push({ entryId: r.entryId ?? `${base}#${n}`, summary: `${r.date} purchase ₹${r.total}` });
    }
  } else if (entity === "cash_book") {
    const all = await db.select().from(s.cashBook).orderBy(asc(s.cashBook.id));
    const occ = new Map<string, number>();
    for (const r of all) {
      if (r.source) continue;
      const base = `${r.date}|${keyText(r.particulars)}|${keyAmount(r.amountIn)}|${keyAmount(r.amountOut)}`;
      const n = (occ.get(base) ?? 0) + 1;
      occ.set(base, n);
      if (ids.includes(r.id)) keys.push({ entryId: r.entryId ?? `${base}#${n}`, summary: `${r.date} ${r.particulars}` });
    }
  } else {
    const all = await db.select().from(s.supplierPayments).orderBy(asc(s.supplierPayments.id));
    const occ = new Map<string, number>();
    for (const r of all) {
      const base = `${r.date}|${r.supplierId}|${keyAmount(r.amount)}`;
      const n = (occ.get(base) ?? 0) + 1;
      occ.set(base, n);
      if (ids.includes(r.id)) keys.push({ entryId: r.entryId ?? `${base}#${n}`, summary: `${r.date} payment ₹${r.amount}` });
    }
  }
  if (keys.length) await db.insert(s.importDeleted).values(keys.map((k) => ({ entity, ...k }))).onConflictDoNothing();
}

export async function deletedKeys(db: DB | Tx, entity: TombEntity) {
  const rows = await db.select({ entryId: schema.importDeleted.entryId }).from(schema.importDeleted).where(eq(schema.importDeleted.entity, entity));
  return new Set(rows.map((r) => r.entryId));
}

export async function forgetDeleted(db: DB | Tx, entity: TombEntity, entryIds: string[]) {
  if (entryIds.length) await db.delete(schema.importDeleted).where(and(eq(schema.importDeleted.entity, entity), inArray(schema.importDeleted.entryId, entryIds)));
}
