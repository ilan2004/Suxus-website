import "server-only";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type { DB, Tx } from "./db";
import { schema } from "./db";

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/&/g, "and").replace(/[^a-z0-9]/g, "");

/** "Riya Plywood (GPay name: SEENATH)" → { base: "Riya Plywood", extra: ["SEENATH"] } */
export function splitSupplierName(name: string) {
  const m = name.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (!m || !m[1].trim()) return { base: name.trim().replace(/\s+/g, " "), extra: [] as string[] };
  const extra = m[2]
    .replace(/g\s*pay\s*name\s*:?/i, "")
    .split(/[\/,;]| or /i)
    .map((x) => x.trim())
    .filter(Boolean);
  return { base: m[1].trim().replace(/\s+/g, " "), extra };
}

function candidates(s: { name: string; aliases: string | null }) {
  const { base, extra } = splitSupplierName(s.name);
  const names = [base, ...extra, ...(s.aliases ?? "").split(",")].map((x) => norm(x)).filter((x) => x.length >= 5);
  return [...new Set(names)];
}

/** Best supplier for a "Paid to" text: the longest name/alias contained in it (or containing it). Ambiguous → null. */
export function matchSupplier(paidTo: string, suppliers: { id: number; name: string; aliases: string | null }[]) {
  const p = norm(paidTo);
  if (p.length < 4) return null;
  let best: { id: number; len: number } | null = null;
  let tie = false;
  for (const s of suppliers) {
    for (const cnd of candidates(s)) {
      // "Paid to" may be a shorter form of the supplier name ("Lights/electrical shop" ⊂ "Lights / electrical shop, Tirur"),
      // but only when it covers most of it — so a person's name never matches a longer business name.
      const hit = p.includes(cnd) || (p.length >= 6 && cnd.includes(p) && p.length / cnd.length >= 0.7);
      if (!hit) continue;
      const len = Math.min(cnd.length, p.length);
      if (!best || len > best.len) {
        best = { id: s.id, len };
        tie = false;
      } else if (len === best.len && best.id !== s.id) tie = true;
    }
  }
  return best && !tie ? best.id : null;
}

/** Links setup expenses with no supplier to the matching supplier (by "Paid to"). */
export async function linkSetupExpenses(db: DB | Tx, onlyIds?: number[]) {
  const suppliers = await db.select({ id: schema.suppliers.id, name: schema.suppliers.name, aliases: schema.suppliers.aliases }).from(schema.suppliers);
  const rows = await db
    .select({ id: schema.setupExpenses.id, paidTo: schema.setupExpenses.paidTo })
    .from(schema.setupExpenses)
    .where(
      and(
        isNull(schema.setupExpenses.supplierId),
        isNotNull(schema.setupExpenses.paidTo),
        onlyIds?.length ? inArray(schema.setupExpenses.id, onlyIds) : undefined,
      ),
    );
  let linked = 0;
  for (const r of rows) {
    const id = matchSupplier(r.paidTo!, suppliers);
    if (id) {
      await db.update(schema.setupExpenses).set({ supplierId: id }).where(eq(schema.setupExpenses.id, r.id));
      linked++;
    }
  }
  return { linked, unlinked: rows.length - linked };
}

/** Moves "(…)" notes out of supplier names into Other names, e.g. "SMART ELECTRICALS & PLUMBING (Bavutt / Babu)". */
export async function tidySupplierNames(db: DB | Tx) {
  const suppliers = await db.select().from(schema.suppliers);
  const taken = new Set(suppliers.map((s) => norm(s.name)));
  let tidied = 0;
  for (const s of suppliers) {
    const { base, extra } = splitSupplierName(s.name);
    if (base === s.name) continue;
    if (taken.has(norm(base)) && norm(base) !== norm(s.name)) continue; // would clash with another supplier
    const aliases = [...new Set([...(s.aliases ? s.aliases.split(",").map((x) => x.trim()) : []), ...extra])].filter(Boolean).join(", ");
    await db.update(schema.suppliers).set({ name: base, aliases: aliases || null }).where(eq(schema.suppliers.id, s.id));
    taken.add(norm(base));
    tidied++;
  }
  return tidied;
}
