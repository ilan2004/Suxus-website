/**
 * One-time data fixes that need code (not just SQL). Run right after the migrations — on deploy
 * (scripts/migrate.ts) and on local start (db/index.ts). Each fix runs once: it is marked done in `counters`.
 * Relative imports only: this file also runs under tsx in the deploy script.
 */
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import * as schema from "./db/schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

/* ───── Sleeve notes in Remarks → Sleeve at armpit / Sleeve at elbow ───── */

const NUM = String.raw`(\d+(?:\.\d+)?)`;
// keyword, optional "loose", optional ":"/"=", the number — and not followed by another figure ("16-17", "16/17")
const ARMPIT = new RegExp(String.raw`(?:കക്ഷം|കക്ഷ|arm\s*pit)\s*(?:loose|ലൂസ്)?\s*[:=]?\s*` + NUM + String.raw`(?!\s*[\d./\-–])`, "giu");
const ELBOW = new RegExp(String.raw`(?:കൈ\s*മുട്ട്|elbow)\s*(?:loose|ലൂസ്)?\s*[:=]?\s*` + NUM + String.raw`(?!\s*[\d./\-–])`, "giu");
const HAS_ARMPIT = /കക്ഷ|arm\s*pit/iu;
const HAS_ELBOW = /കൈ\s*മുട്ട്|elbow/iu;

/** Removes the moved note and tidies what is left ("pocket, കക്ഷം loose 16, collar" → "pocket, collar"). */
function cut(text: string, re: RegExp) {
  return text
    .replace(re, " ")
    .split(/\s*[,·;/]\s*/)
    .map((p) => p.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean)
    .join(", ");
}

export type SleeveNoteResult = { moved: number; armpit: number; elbow: number; records: number; unsure: { id: number; reason: string; remark: string }[] };

/** Pure: what to do with one record. Exported for tests. */
export function planSleeveNotes(m: { garmentType: string; remarks: string | null; values: Record<string, number | null> }) {
  const remark = m.remarks ?? "";
  const out: { values: Record<string, number>; remarks: string | null; reasons: string[] } = { values: {}, remarks: m.remarks, reasons: [] };
  if (!HAS_ARMPIT.test(remark) && !HAS_ELBOW.test(remark)) return out;
  if (m.garmentType !== "Shirt") {
    out.reasons.push(`sleeve note on a ${m.garmentType} (only Shirt has these fields)`);
    return out;
  }
  let text = remark;
  for (const [key, has, re, label] of [
    ["Sleeve armpit", HAS_ARMPIT, ARMPIT, "armpit"],
    ["Sleeve elbow", HAS_ELBOW, ELBOW, "elbow"],
  ] as const) {
    if (!has.test(text)) continue;
    const hits = [...text.matchAll(new RegExp(re.source, re.flags))];
    const mentions = (text.match(new RegExp(has.source, "giu")) ?? []).length;
    if (hits.length !== 1 || mentions !== 1) {
      out.reasons.push(hits.length === 0 ? `${label} mentioned but no single clear number` : `${label} mentioned more than once`);
      continue;
    }
    const value = Number(hits[0][1]);
    const existing = m.values[key];
    if (existing != null && existing !== value) {
      out.reasons.push(`${label}: field already ${existing}, note says ${value}`);
      continue;
    }
    out.values[key] = value;
    text = cut(text, new RegExp(re.source, re.flags));
  }
  if (Object.keys(out.values).length) out.remarks = text || null;
  return out;
}

async function fixSleeveNotes(db: AnyDb): Promise<SleeveNoteResult> {
  const rows: { id: number; garmentType: string; remarks: string | null; values: Record<string, number | null> }[] = await db
    .select({ id: schema.measurements.id, garmentType: schema.measurements.garmentType, remarks: schema.measurements.remarks, values: schema.measurements.values })
    .from(schema.measurements);
  const res: SleeveNoteResult = { moved: 0, armpit: 0, elbow: 0, records: 0, unsure: [] };
  for (const m of rows) {
    const plan = planSleeveNotes(m);
    const keys = Object.keys(plan.values);
    if (keys.length) {
      await db
        .update(schema.measurements)
        .set({ values: { ...m.values, ...plan.values }, remarks: plan.remarks, updatedAt: new Date() })
        .where(eq(schema.measurements.id, m.id));
      res.records++;
      res.moved += keys.length;
      if (plan.values["Sleeve armpit"] != null) res.armpit++;
      if (plan.values["Sleeve elbow"] != null) res.elbow++;
    }
    for (const reason of plan.reasons) res.unsure.push({ id: m.id, reason, remark: m.remarks ?? "" });
  }
  // Leave the result where the Owner sees it (Measurements page) and a row per note to check
  await db.insert(schema.auditLog).values({
    staffName: "system",
    action: "update",
    entity: "measurement",
    summary: `Sleeve notes: ${res.moved} moved from Remarks (${res.armpit} armpit, ${res.elbow} elbow) on ${res.records} record(s); ${res.unsure.length} to check`,
  });
  if (res.unsure.length)
    await db.insert(schema.auditLog).values(
      res.unsure.map((u) => ({ staffName: "system", action: "update", entity: "measurement-check", entityId: String(u.id), summary: `${u.reason} — “${u.remark}”` })),
    );
  return res;
}

/* ───── Fabric per order item: the order's fabric copied onto each of its items ───── */

export type ItemFabricResult = { orders: number; items: number; skipped: { orderNo: string; reason: string }[] };

/**
 * Before, the fabric belonged to the ORDER (its linked fabric bill). Each garment now has its own. For every order whose
 * bill has exactly one shop fabric, that fabric is copied onto each item that has none yet. An order whose bill has
 * several fabrics is left for a person to choose (which cloth belongs to which garment cannot be known) and listed.
 */
async function fixItemFabricFromBill(db: AnyDb): Promise<ItemFabricResult> {
  const res: ItemFabricResult = { orders: 0, items: 0, skipped: [] };
  const orders: { id: number; orderNo: string; saleId: number }[] = await db
    .select({ id: schema.orders.id, orderNo: schema.orders.orderNo, saleId: schema.orders.saleId })
    .from(schema.orders)
    .where(isNotNull(schema.orders.saleId));
  for (const o of orders) {
    const [sale] = await db.select({ cancelled: schema.sales.cancelled }).from(schema.sales).where(eq(schema.sales.id, o.saleId));
    if (!sale || sale.cancelled) continue;
    const lines: { fabricId: number | null }[] = await db.select({ fabricId: schema.saleItems.fabricId }).from(schema.saleItems).where(eq(schema.saleItems.saleId, o.saleId));
    const fabrics = [...new Set(lines.map((l) => l.fabricId).filter((x): x is number => !!x))];
    if (fabrics.length !== 1) {
      if (fabrics.length > 1) res.skipped.push({ orderNo: o.orderNo, reason: `bill has ${fabrics.length} fabrics — choose per garment` });
      continue;
    }
    const items: { id: number }[] = await db.select({ id: schema.orderItems.id }).from(schema.orderItems).where(eq(schema.orderItems.orderId, o.id));
    if (!items.length) continue;
    const have: { id: number }[] = await db
      .select({ id: schema.orderItemFabrics.orderItemId })
      .from(schema.orderItemFabrics)
      .where(inArray(schema.orderItemFabrics.orderItemId, items.map((i) => i.id)));
    const todo = items.filter((i) => !have.some((h) => h.id === i.id));
    if (!todo.length) continue;
    await db.insert(schema.orderItemFabrics).values(todo.map((i) => ({ orderItemId: i.id, fabricId: fabrics[0] })));
    res.orders++;
    res.items += todo.length;
  }
  await db.insert(schema.auditLog).values({
    staffName: "system",
    action: "update",
    entity: "order",
    summary: `Fabric per garment: the order's fabric copied onto ${res.items} item(s) in ${res.orders} order(s)${res.skipped.length ? `; ${res.skipped.length} order(s) with several fabrics left to choose: ${res.skipped.map((x) => x.orderNo).join(", ")}` : ""}`,
  });
  return res;
}

/* ───── Runner ───── */

const FIXES: { key: string; run: (db: AnyDb) => Promise<unknown> }[] = [
  { key: "fix:sleeve-notes", run: fixSleeveNotes },
  { key: "fix:item-fabric-from-bill", run: fixItemFabricFromBill },
];

export async function runDataFixes(db: AnyDb, log: (s: string) => void = () => {}) {
  const done: { key: string }[] = await db
    .select({ key: schema.counters.key })
    .from(schema.counters)
    .where(and(inArray(schema.counters.key, FIXES.map((f) => f.key)), eq(schema.counters.value, 1)));
  for (const fix of FIXES) {
    if (done.some((d) => d.key === fix.key)) continue;
    const result = await db.transaction(async (tx: AnyDb) => {
      const r = await fix.run(tx);
      await tx.insert(schema.counters).values({ key: fix.key, value: 1 }).onConflictDoUpdate({ target: schema.counters.key, set: { value: 1 } });
      return r;
    });
    log(`[data-fix] ${fix.key}: ${JSON.stringify(result)}`);
  }
}
