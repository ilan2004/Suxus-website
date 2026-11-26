import "server-only";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { getDb, schema } from "./db";
import { col } from "./db/ext";
import { features } from "./db/features";
import { orderFabricPlan } from "./order-fabric";
import { requirementText } from "./fabric-requirement";
import { getOrderFull } from "./queries";
import { GARMENTS, WHOLE_ML, fieldsFor, mlOf, enOf, wholeOf, type GarmentField } from "./measurements";
import { formatPhone } from "./phone";
import { fmtDate } from "./utils";
import { variantMl, variantRequired } from "./variants";

/** Printed at the top of every job slip page. */
export const JOB_SLIP_SHOP = { name: "SUXUS Heritage Tailor", line: "Pallikkal Bazar · Ph 95443 76072" };

import { itemCode } from "./job-slip-code";
export { itemCode, parseItemCode } from "./job-slip-code";

type Measure = { id: number; garmentType: string; date: string; size: string | null; fit: string | null; values: Record<string, number | null>; remarks: string | null };
export type JobSlipPage = {
  orderId: number;
  itemId: number;
  orderNo: string;
  code: string;
  page: number;
  pages: number;
  date: string;
  deliveryDate: string | null;
  urgency: string;
  customer: string;
  phone: string;
  wearer: string;
  wearerDetail: string;
  item: string;
  variant: string | null;
  qty: number;
  tailor: string | null;
  measures: Measure[];
  /** No record of this garment for this person — the person's other garments are shown instead. */
  measuresNote: string | null;
  fabrics: { code: string; name: string; hex: string | null }[];
  /** Fabric requirement for this garment ("തുണി വേണ്ടത്: 1.70 മീറ്റർ" + the rule), or the missing measurement */
  requirement: { text: string; rule: string } | { missing: string } | null;
  remarks: string[];
};

/** "Shirt" ↔ order items "Shirt", "School Shirt", "Uniform Shirt"; "Pant / Trouser" ↔ "Pant"; "Churidar" → top and bottom. */
function garmentsFor(item: string, garments: string[]) {
  const it = item.toLowerCase();
  const exact = garments.filter((g) => g.toLowerCase() === it);
  if (exact.length) return exact;
  const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4);
  return garments.filter((g) => words(g).some((w) => it.includes(w)) || words(item).some((w) => g.toLowerCase().includes(w)));
}

/** One page per order item (or just the one item), each complete on its own. */
export async function jobSlipPages(orderId: number, itemId?: number | null): Promise<JobSlipPage[] | null> {
  // Job slips name the person for each garment: off until the database has Wearers and the job slip tables
  if (!(await features()).jobSlip) return null;
  const order = await getOrderFull(orderId);
  if (!order) return null;
  const items = itemId ? order.items.filter((i) => i.id === itemId) : order.items;
  if (!items.length) return null;
  const db = await getDb();
  const all: Measure[] = order.customerId
    ? await db
        .select({ id: schema.measurements.id, garmentType: schema.measurements.garmentType, date: schema.measurements.date, size: schema.measurements.size, fit: schema.measurements.fit, values: schema.measurements.values, remarks: schema.measurements.remarks, wearerId: col.measurementWearer })
        .from(schema.measurements)
        .where(eq(schema.measurements.customerId, order.customerId))
        .orderBy(desc(schema.measurements.date), desc(schema.measurements.id))
    : [];
  const selfId = order.customerId
    ? ((await db.select({ id: schema.wearers.id }).from(schema.wearers).where(and(eq(schema.wearers.customerId, order.customerId), eq(schema.wearers.isSelf, true))))[0]?.id ?? null)
    : null;
  // Fabric bought for this order (linked fabric bill)
  const fabricIds = (order.sale?.items ?? []).map((i) => i.fabricId).filter((x): x is number => !!x);
  const fabrics = fabricIds.length
    ? await db.select({ id: schema.fabrics.id, code: schema.fabrics.code, brand: schema.fabrics.brand, shade: schema.fabrics.shade, hex: schema.fabrics.dominantHex }).from(schema.fabrics).where(inArray(schema.fabrics.id, fabricIds))
    : [];
  const fabricList = fabrics.map((f) => ({ code: f.code, name: [f.brand, f.shade].filter(Boolean).join(" · "), hex: f.hex }));

  // Fabric requirement per garment, and the garment's own fabric where one was chosen on the order
  const plan = await orderFabricPlan(order);
  return items.map((i, n) => {
    const who = i.wearerId ?? selfId;
    const mine = (all as (Measure & { wearerId: number | null })[]).filter((m) => (m.wearerId ?? selfId) === who);
    const latest = mine.filter((m, k) => mine.findIndex((x) => x.garmentType === m.garmentType) === k);
    const match = garmentsFor(i.item, latest.map((m) => m.garmentType));
    const measures = match.length ? latest.filter((m) => match.includes(m.garmentType)) : latest;
    const w = i.wearer;
    return {
      orderId: order.id,
      itemId: i.id,
      orderNo: order.orderNo,
      code: itemCode(i.id),
      page: n + 1,
      pages: items.length,
      date: order.date,
      deliveryDate: order.deliveryDate,
      urgency: order.urgency,
      customer: order.customerName ?? "—",
      phone: order.phone ? formatPhone(order.phone) : "",
      wearer: i.wearerName ?? order.customerName ?? "—",
      wearerDetail: w ? (w.isSelf ? "Self · സ്വന്തം" : [w.relation !== "Other" ? w.relation : null, w.school].filter(Boolean).join(" · ")) : "",
      item: i.item,
      // the order item's own variant (തരം) — never worked out from the measurements; null = not set (older item)
      variant: i.variant ?? null,
      qty: i.qty,
      tailor: i.tailor,
      measures,
      measuresNote: !latest.length ? "No measurements saved for this person" : !match.length ? `No ${i.item} record — showing this person's other measurements` : null,
      // the garment's own fabric when known; otherwise every fabric on the order's bill
      fabrics: plan.items[i.id]?.fabric ? [{ code: plan.items[i.id].fabric!.code, name: plan.items[i.id].fabric!.name, hex: plan.items[i.id].fabric!.hex }] : fabricList,
      requirement: (() => {
        const r = plan.items[i.id]?.req;
        if (!r) return null;
        return r.ok ? { text: requirementText(r, i.qty), rule: r.rule } : { missing: r.missing };
      })(),
      remarks: [...measures.map((m) => m.remarks).filter((r): r is string => !!r), ...(order.remarks ? [`Order: ${order.remarks}`] : [])],
    };
  });
}

/** "SUXUS-SO-1042-Anas-Shirt.pdf" — readable, safe for WhatsApp. */
export function jobSlipFileName(pages: JobSlipPage[], whole: boolean) {
  const clean = (s: string) => s.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const p = pages[0];
  return whole || pages.length > 1 ? `SUXUS-${clean(p.orderNo)}-job-slips.pdf` : `SUXUS-${clean(p.orderNo)}-${clean(p.wearer)}-${clean(p.item)}.pdf`;
}

/* ───────────────────────── PDF ───────────────────────── */

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");
const BOLD = path.join(FONT_DIR, "AnekMalayalam-Bold.ttf");
const MEDIUM = path.join(FONT_DIR, "AnekMalayalam-Medium.ttf");

/**
 * A4 portrait, one garment per page, made to be read on a phone: one column, no tables, black on white,
 * the person's name large above the measurements and every number large and bold on its own line.
 */
export async function renderJobSlipPdf(pages: JobSlipPage[]): Promise<Buffer> {
  const { default: PDFDocument } = await import("pdfkit");
  const { default: barcodes } = (await import("jsbarcode/bin/barcodes")) as unknown as { default: Record<string, new (d: string, o: object) => { encode: () => { data: string } }> };
  const bold = fs.readFileSync(BOLD);
  const medium = fs.readFileSync(MEDIUM);
  const doc = new PDFDocument({ size: "A4", margin: 40, font: BOLD, autoFirstPage: false, info: { Title: `${pages[0].orderNo} job slip`, Author: JOB_SLIP_SHOP.name } });
  doc.registerFont("B", bold);
  doc.registerFont("M", medium);
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  const L = 40;
  const W = 595.28 - 80;
  const BOTTOM = 841.89 - 50;
  const black = "#000000";

  const barcode = (value: string, x: number, y: number, w: number, h: number) => {
    const bits = new barcodes.CODE128(value, {}).encode().data;
    const unit = w / bits.length;
    let i = 0;
    while (i < bits.length) {
      if (bits[i] === "1") {
        let j = i;
        while (j < bits.length && bits[j] === "1") j++;
        doc.rect(x + i * unit, y, (j - i) * unit, h).fill(black);
        i = j;
      } else i++;
    }
  };
  const rule = (weight = 2) => {
    doc.moveTo(L, doc.y).lineTo(L + W, doc.y).lineWidth(weight).strokeColor(black).stroke();
    doc.y += 8;
  };
  const text = (s: string, size: number, font: "B" | "M" = "B", opts: PDFKit.Mixins.TextOptions = {}) => {
    doc.font(font).fontSize(size).fillColor(black).text(s, L, doc.y, { width: W, ...opts });
  };

  for (const p of pages) {
    doc.addPage();
    /** Page header — repeated on a continuation page so every page stands alone. */
    const header = (continued: boolean) => {
      doc.y = 34;
      doc.font("B").fontSize(13).fillColor(black).text(JOB_SLIP_SHOP.name, L, doc.y, { continued: true }).font("M").text(`   ${JOB_SLIP_SHOP.line}`);
      doc.y += 4;
      rule(1.5);
      const top = doc.y;
      text(`${p.orderNo}${p.pages > 1 ? `  ·  ${p.page} / ${p.pages}` : ""}${p.urgency === "Express" ? "  ·  EXPRESS" : ""}`, 24);
      barcode(p.code, L + W - 180, top + 2, 180, 30);
      doc.font("M").fontSize(10).fillColor(black).text(p.code, L + W - 180, top + 34, { width: 180, align: "center" });
      doc.y = Math.max(doc.y, top + 46);
      if (continued) {
        text(`${p.wearer.toUpperCase()} · ${p.item} — continued`, 18);
        doc.y += 4;
        rule(1.5);
      }
    };
    header(false);
    text(`Delivery  ${p.deliveryDate ? fmtDate(p.deliveryDate) : "—"}`, 22);
    text(`Taken ${fmtDate(p.date)}   ·   ${p.customer}${p.phone ? `  ${p.phone}` : ""}`, 14, "M");
    doc.y += 6;
    rule(3);

    // The person — the most important line when a parent brought work for several children
    text(p.wearer.toUpperCase(), 38, "B", { lineGap: -6 });
    if (p.wearerDetail) text(p.wearerDetail, 15, "M");
    doc.y += 2;
    text(`${p.item}${p.variant ? ` — ${p.variant}` : variantRequired(p.item) ? " — variant not set" : ""}${p.qty > 1 ? `  ×  ${p.qty}` : ""}`, 22);
    if (p.variant && variantMl(p.variant) !== p.variant) text(`തരം: ${variantMl(p.variant)}`, 16);
    text(`Tailor  ${p.tailor ?? "Not assigned yet"}`, 18);
    doc.y += 4;
    rule(3);

    const ensure = (h: number) => {
      if (doc.y + h > BOTTOM) {
        doc.addPage();
        header(true);
      }
    };

    // What comes after the measurements (fabric, remarks) — reserved so the page holds everything
    doc.font("B").fontSize(16);
    const remarksH = p.remarks.reduce((h, r) => h + doc.heightOfString(r, { width: W }) + 2, p.remarks.length ? 22 : 0);
    const footerH = 16 + (p.fabrics.length ? 18 + p.fabrics.length * 26 : 22) + (p.requirement ? 44 : 0) + remarksH;
    const rows = p.measures.reduce((n, m) => n + 1 + (GARMENTS[m.garmentType] ? GARMENTS[m.garmentType] : fieldsFor(m.garmentType, m.values)).filter((f) => m.values[f.key] != null).length, 0);
    // Row height from the space left: large when there is room, never smaller than readable on a phone
    const rowH = Math.max(34, Math.min(48, (BOTTOM - doc.y - footerH) / Math.max(1, rows)));
    const k = rowH / 48; // 1 = full size
    const numSize = Math.max(26, Math.round(34 * k));
    const mlSize = Math.max(17, Math.round(21 * k));

    if (p.measuresNote) text(p.measuresNote, 14, "M");
    for (const m of p.measures) {
      ensure(rowH);
      text(`${m.garmentType}  ·  measured ${fmtDate(m.date)}${m.size ? `  ·  Size ${m.size}` : ""}${m.fit ? `  ·  ${m.fit}` : ""}`, 13, "M");
      doc.y += Math.max(2, rowH - 30);
      const fields: GarmentField[] = (GARMENTS[m.garmentType] ? GARMENTS[m.garmentType] : fieldsFor(m.garmentType, m.values)).filter((f) => m.values[f.key] != null);
      if (!fields.length) text("No numbers filled in", 15, "M");
      for (const f of fields) {
        const v = m.values[f.key]!;
        const whole = wholeOf(f, v);
        ensure(rowH);
        const y = doc.y;
        // Malayalam label, English under it · the derived whole beside the number · the number large on the right
        doc.font("B").fontSize(mlSize).fillColor(black).text(mlOf(f), L, y, { width: W * 0.42 });
        doc.font("M").fontSize(10.5).fillColor(black).text(enOf(f), L, y + mlSize + 3, { width: W * 0.42 });
        doc.font("B").fontSize(numSize).fillColor(black).text(String(Math.round(v * 100) / 100), L + W - 120, y - 2, { width: 120, align: "right" });
        if (whole != null) doc.font("B").fontSize(Math.max(14, Math.round(17 * k))).fillColor(black).text(`(${WHOLE_ML[f.part!.whole] ?? f.part!.whole} ${whole})`, L + W * 0.36, y + 6, { width: W - W * 0.36 - 128, align: "right" });
        doc.y = y + rowH;
        doc.moveTo(L, doc.y - 5).lineTo(L + W, doc.y - 5).lineWidth(0.6).strokeColor(black).stroke();
      }
    }

    ensure(footerH);
    doc.y += 2;
    rule(3);
    // Required metres next to the fabric name (one fabric), or on its own line
    const reqText = p.requirement ? ("text" in p.requirement ? `${p.requirement.text.replace("തുണി വേണ്ടത്: ", "വേണ്ടത് ")}` : p.requirement.missing) : null;
    if (p.fabrics.length) {
      text(p.fabrics.length > 1 ? "Fabric on this order" : "Fabric", 13, "M");
      for (const f of p.fabrics) {
        const y = doc.y + 2;
        if (f.hex) doc.rect(L, y, 22, 22).fillAndStroke(f.hex, black);
        const x = L + (f.hex ? 32 : 0);
        doc.font("B").fontSize(16).fillColor(black).text(`${f.code}  ${f.name}`, x, y + 2, { width: W - 32, continued: !!(reqText && p.fabrics.length === 1) });
        if (reqText && p.fabrics.length === 1) doc.text(`   —   ${reqText}`);
        doc.y = Math.max(doc.y, y + 26);
      }
      if (reqText && p.fabrics.length > 1) text(`തുണി ${reqText}`, 16);
    } else {
      text("Fabric: customer's own / not linked", 14, "M");
      if (reqText) text(`തുണി ${reqText}`, 16);
    }
    if (p.requirement && "rule" in p.requirement) text(`(${p.requirement.rule})`, 12, "M");
    if (p.remarks.length) {
      doc.y += 2;
      text("Remarks", 13, "M");
      for (const r of p.remarks) {
        ensure(24);
        text(r, 16);
      }
    }
  }
  doc.end();
  return done;
}

/* ───────────────────────── Links and record ───────────────────────── */

/** The unguessable link token for an item's page (or the whole order): 32 random bytes, created once. */
export async function jobSlipToken(orderId: number, itemId: number | null): Promise<string> {
  const db = await getDb();
  const kind = itemId ? "item" : "order";
  const where = and(eq(schema.jobSlipLinks.kind, kind), eq(schema.jobSlipLinks.orderId, orderId), itemId ? eq(schema.jobSlipLinks.orderItemId, itemId) : isNull(schema.jobSlipLinks.orderItemId));
  const [found] = await db.select({ token: schema.jobSlipLinks.token }).from(schema.jobSlipLinks).where(where);
  if (found) return found.token;
  const token = crypto.randomBytes(32).toString("base64url");
  await db.insert(schema.jobSlipLinks).values({ kind, orderId, orderItemId: itemId, token }).onConflictDoNothing();
  const [row] = await db.select({ token: schema.jobSlipLinks.token }).from(schema.jobSlipLinks).where(where);
  return row.token;
}

/** Token → which job slip. Nothing else is reachable from a token. */
export async function resolveJobSlipToken(token: string) {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token) || !(await features()).jobSlip) return null;
  const db = await getDb();
  const [row] = await db
    .select({ orderId: schema.jobSlipLinks.orderId, itemId: schema.jobSlipLinks.orderItemId, kind: schema.jobSlipLinks.kind })
    .from(schema.jobSlipLinks)
    .where(eq(schema.jobSlipLinks.token, token));
  if (!row) return null;
  // constant-time comparison is not needed: the token is looked up by its exact value and is 256 bits of randomness
  return row;
}

export async function logJobSlip(e: { orderId: number; itemId: number | null; action: "label" | "view" | "share"; via: "app" | "link"; staffName: string | null; detail: string | null }) {
  if (!(await features()).jobSlip) return;
  const db = await getDb();
  await db.insert(schema.jobSlipEvents).values({ orderId: e.orderId, orderItemId: e.itemId, action: e.action, via: e.via, staffName: e.staffName, detail: e.detail });
}
