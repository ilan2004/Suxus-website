import "server-only";
import ExcelJS from "exceljs";
import { eq, sql } from "drizzle-orm";
import { getDb, schema, type DB } from "./db";
import { counters } from "./db/schema";
import { getSettings, saveSetting } from "./settings";
import type { Lists } from "./defaults";
import { linkSetupExpenses, splitSupplierName, tidySupplierNames } from "./supplier-link";

type Cell = ExcelJS.CellValue;

/** Plain value of a cell (formula result, rich text, hyperlink text …). */
function val(v: Cell): string | number | Date | boolean | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return val(v.result as Cell);
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("error" in v) return null;
    return null;
  }
  return v;
}
const str = (v: Cell) => {
  const x = val(v);
  if (x == null) return null;
  const s = (x instanceof Date ? x.toISOString().slice(0, 10) : String(x)).trim();
  return s === "" ? null : s;
};
const n = (v: Cell) => {
  const x = val(v);
  if (x == null || x === "") return null;
  const num = typeof x === "number" ? x : Number(String(x).replace(/[₹,\s]/g, ""));
  return Number.isFinite(num) ? num : null;
};
const d = (v: Cell) => {
  const x = val(v);
  if (x instanceof Date) return x.toISOString().slice(0, 10);
  if (typeof x === "number") return new Date(Math.round((x - 25569) * 86400000)).toISOString().slice(0, 10); // Excel serial
  if (typeof x === "string") {
    const m = x.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/); // 08-09-2026
    if (m) return `${m[3].length === 2 ? "20" + m[3] : m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (/^\d{4}-\d{2}-\d{2}/.test(x)) return x.slice(0, 10);
  }
  return null;
};
const yes = (v: Cell) => /^y/i.test(str(v) ?? "");

/** Data rows (row 3 onwards, header in row 2) that have something in `keyCols`. */
function rows(ws: ExcelJS.Worksheet | undefined, keyCols: number[]) {
  const out: ExcelJS.Row[] = [];
  if (!ws) return out;
  ws.eachRow({ includeEmpty: false }, (row, i) => {
    if (i < 3) return;
    // Notes / headings typed across merged cells (e.g. "2. Two figures in red…") are not data
    const a = row.getCell(1);
    const b = row.getCell(2);
    if (b.isMerged && b.master?.address === a.address) return;
    if (keyCols.every((c) => str(row.getCell(c).value) != null)) out.push(row);
  });
  return out;
}

async function isEmpty(db: DB, table: typeof schema.customers | typeof schema.fabrics | typeof schema.setupExpenses | typeof schema.openingStock | typeof schema.purchases | typeof schema.cashBook) {
  const [r] = await db.select({ c: sql<number>`count(*)`.mapWith(Number) }).from(table);
  return r.c === 0;
}

async function bumpCounter(db: DB, key: string, value: number) {
  await db
    .insert(counters)
    .values({ key, value })
    .onConflictDoUpdate({ target: counters.key, set: { value: sql`greatest(${counters.value}, ${value})` } });
}

export type ImportReport = Record<string, string>;

/** Removes pictures / drawings / comments — the import only needs cell values, and ExcelJS can crash on some drawings. */
async function stripDrawings(buffer: ArrayBuffer) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  for (const name of Object.keys(zip.files)) {
    if (/^xl\/(drawings|media|comments|threadedComments|persons)\//.test(name) || /^xl\/comments\d*\.xml$/.test(name)) zip.remove(name);
  }
  for (const name of Object.keys(zip.files)) {
    if (/^xl\/worksheets\/sheet\d+\.xml$/.test(name)) {
      const xml = await zip.file(name)!.async("string");
      zip.file(name, xml.replace(/<drawing [^>]*\/>/g, "").replace(/<legacyDrawing [^>]*\/>/g, ""));
    }
    if (/^xl\/worksheets\/_rels\/.*\.rels$/.test(name)) {
      const xml = await zip.file(name)!.async("string");
      zip.file(name, xml.replace(/<Relationship [^>]*Type="[^"]*\/(drawing|vmlDrawing|comments)"[^>]*\/>/g, ""));
    }
    if (name === "[Content_Types].xml") {
      const xml = await zip.file(name)!.async("string");
      zip.file(name, xml.replace(/<Override [^>]*PartName="\/xl\/(drawings|comments)[^"]*"[^>]*\/>/g, ""));
    }
  }
  return zip.generateAsync({ type: "arraybuffer" });
}

async function loadWorkbook(buffer: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
    return wb;
  } catch {
    const clean = new ExcelJS.Workbook();
    await clean.xlsx.load(await stripDrawings(buffer));
    return clean;
  }
}

export async function importWorkbook(buffer: ArrayBuffer): Promise<ImportReport> {
  const wb = await loadWorkbook(buffer);
  const db = await getDb();
  const report: ImportReport = {};
  const ws = (name: string) => wb.getWorksheet(name);

  /* ── Lists, shop info, piece rates, compositions, incentive slabs ── */
  const L = ws("Lists");
  if (L) {
    const col = (c: number) => {
      const items: string[] = [];
      for (let r = 3; r <= 40; r++) {
        const s = str(L.getCell(r, c).value);
        if (s && !s.startsWith("◀")) items.push(s);
      }
      return items;
    };
    const current = await getSettings();
    const lists: Lists = {
      ...current.lists,
      workType: col(1),
      item: col(2),
      status: col(3),
      paymentMode: col(4),
      fabricType: col(5),
      cashCategory: col(8),
      setupCategory: col(9),
      partner: col(10),
      staffRole: col(11),
      payType: col(12),
      assetType: col(13),
      urgency: col(15),
      colourFamily: col(20),
    };
    for (const k of Object.keys(lists) as (keyof Lists)[]) if (!lists[k].length) lists[k] = current.lists[k];
    await saveSetting("lists", lists);

    const q = (r: number) => str(L.getCell(r, 17).value) ?? "";
    await saveSetting("shop", {
      ...current.shop,
      name: q(3) || current.shop.name,
      tagline: q(4),
      services: q(5),
      address1: q(6),
      address2: q(7),
      phone: q(8),
      email: q(9),
      gstin: q(10),
      footer: q(11) || current.shop.footer,
    });

    const comps = col(18).map((name, i) => ({ name, prefix: col(19)[i] ?? "OTH" }));
    if (comps.length) await saveSetting("compositions", comps);

    const rates: Record<string, number> = {};
    for (let r = 3; r <= 40; r++) {
      const item = str(L.getCell(r, 25).value);
      const rate = n(L.getCell(r, 26).value);
      if (item && rate != null) rates[item] = rate;
    }
    await saveSetting("pieceRates", rates);
    report.Settings = "Dropdown lists, shop info, piece rates and fabric codes updated";
  }

  const I = ws("Incentive");
  if (I) {
    const slabs = [5, 6, 7, 8]
      .map((r) => ({ from: n(I.getCell(r, 2).value), to: n(I.getCell(r, 3).value), rate: n(I.getCell(r, 4).value) }))
      .filter((s): s is { from: number; to: number; rate: number } => s.from != null && s.to != null && s.rate != null);
    if (slabs.length) await saveSetting("slabs", slabs);
  }

  /* ── Staff (merged by name, logins kept) ── */
  {
    let added = 0,
      updated = 0,
      maxCode = 0;
    for (const r of rows(ws("Staff"), [2])) {
      const code = str(r.getCell(1).value);
      const name = str(r.getCell(2).value)!;
      const values = {
        role: str(r.getCell(3).value),
        phone: str(r.getCell(4).value),
        joinDate: d(r.getCell(5).value),
        payType: str(r.getCell(6).value),
        monthlySalary: n(r.getCell(7).value),
        pieceRate: n(r.getCell(8).value),
        incentive: yes(r.getCell(9).value),
        ownIncentivePct: n(r.getCell(10).value),
        status: str(r.getCell(11).value) === "Left" ? "Left" : "Active",
        remarks: str(r.getCell(12).value),
      };
      const m = code?.match(/(\d+)/);
      if (m) maxCode = Math.max(maxCode, Number(m[1]));
      const [existing] = await db.select({ id: schema.staff.id }).from(schema.staff).where(eq(schema.staff.name, name));
      if (existing) {
        await db.update(schema.staff).set(values).where(eq(schema.staff.id, existing.id));
        updated++;
      } else {
        const [clash] = code ? await db.select({ id: schema.staff.id }).from(schema.staff).where(eq(schema.staff.code, code)) : [];
        const finalCode = code && !clash ? code : `S${String(++maxCode).padStart(2, "0")}`;
        await db.insert(schema.staff).values({ ...values, name, code: finalCode });
        added++;
      }
    }
    await bumpCounter(db, "staff", maxCode);
    report.Staff = `${added} added, ${updated} updated`;
  }

  /* ── Suppliers (skipped when the name already exists) ── */
  {
    let added = 0;
    for (const r of rows(ws("Suppliers"), [1])) {
      const fullName = str(r.getCell(1).value)!;
      const rest = [2, 3, 4, 5, 6, 7, 8].map((c) => str(r.getCell(c).value));
      if (rest.every((x) => x == null)) continue; // notes rows
      // "SMART ELECTRICALS & PLUMBING (Bavutt / Babu)" → name + other names
      const { base: name, extra } = splitSupplierName(fullName);
      const [exists] = await db.select({ id: schema.suppliers.id }).from(schema.suppliers).where(sql`lower(${schema.suppliers.name}) in (lower(${name}), lower(${fullName}))`);
      if (exists) continue;
      const paidCell = r.getCell(9).value;
      const dueCell = r.getCell(10).value;
      const manual =
        paidCell && typeof paidCell !== "object" ? `Paid so far (Excel): ₹${n(paidCell)}; Balance due (Excel): ₹${n(dueCell) ?? 0}. ` : "";
      await db.insert(schema.suppliers).values({
        name,
        type: rest[0],
        place: rest[1],
        phone: rest[2],
        upi: rest[3],
        bank: rest[4],
        gstNo: rest[5],
        supplies: rest[6],
        aliases: extra.length ? extra.join(", ") : null,
        notes: (manual + (str(r.getCell(12).value) ?? "")).trim() || null,
      });
      added++;
    }
    report.Suppliers = `${added} added`;
  }

  /* ── Payments on account (money paid later for goods taken on credit) ── */
  {
    const sheet = wb.worksheets.find((w) => /payments?\s*(on|to)?\s*(account|a\s*\/\s*c)/i.test(w.name));
    const [existing] = await db.select({ c: sql<number>`count(*)`.mapWith(Number) }).from(schema.supplierPayments);
    if (sheet && existing.c === 0) {
      let added = 0;
      const all = await db.select({ id: schema.suppliers.id, name: schema.suppliers.name }).from(schema.suppliers);
      const norm = (x: string) => x.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]/g, "");
      for (const r of rows(sheet, [2, 3])) {
        const name = str(r.getCell(2).value)!;
        const amount = n(r.getCell(3).value);
        if (amount == null || /^total$/i.test(name)) continue;
        const key = norm(name);
        let sup = all.find((x) => norm(x.name) === key) ?? all.find((x) => norm(x.name).includes(key) || key.includes(norm(x.name)));
        if (!sup) {
          [sup] = await db.insert(schema.suppliers).values({ name }).returning({ id: schema.suppliers.id, name: schema.suppliers.name });
          all.push(sup);
        }
        const date = d(r.getCell(1).value);
        const note = [str(r.getCell(6).value), date ? null : "(date not filled in Excel — set to import day)"].filter(Boolean).join(" ");
        await db.insert(schema.supplierPayments).values({
          supplierId: sup.id,
          date: date ?? new Date().toISOString().slice(0, 10),
          amount,
          mode: str(r.getCell(4).value) ?? "Cash",
          ref: str(r.getCell(5).value),
          paidBy: null, // Excel doesn't say who paid — kept out of the cash book, like the workbook
          note: note || null,
        });
        added++;
      }
      report["Payments on Account"] = `${added} imported`;
    } else if (sheet) report["Payments on Account"] = "skipped (supplier payments already exist)";
    else report["Payments on Account"] = "sheet not found in this file — add the supplier payments with Suppliers → Pay supplier";
  }

  /* ── Setup expenses ── */
  if (await isEmpty(db, schema.setupExpenses)) {
    const list = rows(ws("Setup Expenses"), [1, 2])
      .map((r) => ({
        date: d(r.getCell(1).value),
        category: str(r.getCell(2).value)!,
        description: str(r.getCell(3).value),
        paidTo: str(r.getCell(4).value),
        paidBy: str(r.getCell(5).value) ?? "Business Account",
        amount: n(r.getCell(6).value),
        mode: str(r.getCell(7).value),
        billNo: str(r.getCell(8).value),
        hasBill: yes(r.getCell(9).value),
        remarks: str(r.getCell(10).value),
      }))
      .filter((x): x is typeof x & { date: string; amount: number } => !!x.date && x.amount != null);
    if (list.length) await db.insert(schema.setupExpenses).values(list);
    report["Setup Expenses"] = `${list.length} imported`;
  } else report["Setup Expenses"] = "skipped (already has data)";

  /* ── Opening stock & assets ── */
  if (await isEmpty(db, schema.openingStock)) {
    const list = rows(ws("Opening Stock"), [2, 3]).map((r) => ({
      assetType: str(r.getCell(2).value)!,
      description: str(r.getCell(3).value)!,
      qty: n(r.getCell(4).value) ?? 0,
      unitValue: n(r.getCell(5).value) ?? 0,
      ownedBy: str(r.getCell(7).value) ?? "Business Account",
      condition: str(r.getCell(8).value),
      valuationDate: d(r.getCell(9).value),
      remarks: str(r.getCell(10).value),
    }));
    if (list.length) await db.insert(schema.openingStock).values(list);
    report["Opening Stock"] = `${list.length} imported`;
  } else report["Opening Stock"] = "skipped (already has data)";

  /* ── Customers ── */
  if (await isEmpty(db, schema.customers)) {
    let max = 0;
    const list = rows(ws("Customers"), [2]).map((r, i) => {
      const code = str(r.getCell(1).value) ?? `C-${String(i + 1).padStart(4, "0")}`;
      const m = code.match(/(\d+)/);
      if (m) max = Math.max(max, Number(m[1]));
      return {
        code,
        name: str(r.getCell(2).value)!,
        phone: str(r.getCell(3).value)?.replace(/[^\d+]/g, "") ?? null,
        place: str(r.getCell(4).value),
        type: str(r.getCell(5).value),
        firstVisit: d(r.getCell(6).value),
        remarks: str(r.getCell(7).value),
      };
    });
    if (list.length) await db.insert(schema.customers).values(list);
    await bumpCounter(db, "C", Math.max(max, list.length));
    report.Customers = `${list.length} imported`;
  } else report.Customers = "skipped (already has data)";

  /* ── Fabric stock ── */
  if (await isEmpty(db, schema.fabrics)) {
    const comps = (await getSettings()).compositions;
    const perPrefix: Record<string, number> = {};
    const list = rows(ws("Fabric Stock"), [3]).map((r) => {
      const composition = str(r.getCell(17).value) ?? "Other";
      const prefix = comps.find((c) => c.name === composition)?.prefix ?? "OTH";
      let code = str(r.getCell(1).value);
      if (!code) code = `${prefix}-${String((perPrefix[prefix] ?? 0) + 1).padStart(3, "0")}`;
      const m = code.match(/^([A-Z]+)-(\d+)$/);
      if (m) perPrefix[m[1]] = Math.max(perPrefix[m[1]] ?? 0, Number(m[2]));
      return {
        code,
        barcode: str(r.getCell(2).value),
        brand: str(r.getCell(3).value)!,
        type: str(r.getCell(4).value),
        shade: str(r.getCell(5).value),
        purchaseDate: d(r.getCell(7).value),
        purchaseMtr: n(r.getCell(8).value) ?? 0,
        costPerMtr: n(r.getCell(9).value) ?? 0,
        saleRate: n(r.getCell(11).value) ?? 0,
        remarks: [str(r.getCell(6).value) && `Supplier: ${str(r.getCell(6).value)}`, str(r.getCell(15).value)].filter(Boolean).join(" · ") || null,
        composition,
        colourFamily: str(r.getCell(18).value),
      };
    });
    if (list.length) await db.insert(schema.fabrics).values(list);
    for (const [p, v] of Object.entries(perPrefix)) await bumpCounter(db, `fabric:${p}`, v);
    report["Fabric Stock"] = `${list.length} imported`;
  } else report["Fabric Stock"] = "skipped (already has data)";

  /* ── Cash book (manual entries) ── */
  if (await isEmpty(db, schema.cashBook)) {
    const list = rows(ws("Cash Book"), [1, 2])
      .map((r) => ({
        date: d(r.getCell(1).value),
        particulars: str(r.getCell(2).value)!,
        category: str(r.getCell(3).value) ?? "Other Expense",
        amountIn: n(r.getCell(4).value) ?? 0,
        amountOut: n(r.getCell(5).value) ?? 0,
        mode: str(r.getCell(6).value) ?? "Cash",
        remarks: str(r.getCell(8).value),
        partner: str(r.getCell(9).value),
      }))
      .filter((x): x is typeof x & { date: string } => !!x.date);
    if (list.length) await db.insert(schema.cashBook).values(list);
    report["Cash Book"] = `${list.length} imported`;
  } else report["Cash Book"] = "skipped (already has entries)";

  /* ── Purchases ── */
  if (await isEmpty(db, schema.purchases)) {
    const list = [];
    for (const r of rows(ws("Purchases"), [1, 2])) {
      const date = d(r.getCell(1).value);
      if (!date) continue;
      const supplierName = str(r.getCell(2).value)!;
      let [sup] = await db.select({ id: schema.suppliers.id }).from(schema.suppliers).where(eq(schema.suppliers.name, supplierName));
      if (!sup) [sup] = await db.insert(schema.suppliers).values({ name: supplierName }).returning({ id: schema.suppliers.id });
      const qty = n(r.getCell(5).value) ?? 0;
      const rate = n(r.getCell(6).value) ?? 0;
      const taxable = qty * rate;
      const gstPct = n(r.getCell(8).value) ?? 0;
      const gstAmount = taxable * (gstPct > 1 ? gstPct / 100 : gstPct);
      list.push({
        date,
        supplierId: sup.id,
        invoiceNo: str(r.getCell(3).value),
        description: str(r.getCell(4).value),
        qty,
        rate,
        taxable,
        gstPct: gstPct > 1 ? gstPct : gstPct * 100,
        gstAmount,
        total: taxable + gstAmount,
        paid: n(r.getCell(11).value) ?? 0,
        remarks: str(r.getCell(13).value),
      });
    }
    if (list.length) await db.insert(schema.purchases).values(list);
    report.Purchases = `${list.length} imported`;
  } else report.Purchases = "skipped (already has data)";

  /* ── Link setup expenses to suppliers by "Paid to" (and tidy old bracket names) ── */
  const tidied = await tidySupplierNames(db);
  const { linked, unlinked } = await linkSetupExpenses(db);
  report["Supplier links"] = `${linked} setup expenses linked to suppliers${unlinked ? `, ${unlinked} without a matching supplier` : ""}${tidied ? `, ${tidied} names tidied` : ""}`;

  return report;
}
