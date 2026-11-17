/**
 * Reads phone-contact exports in the browser: .csv / .xlsx (columns Name, Phone — Google Contacts exports work too)
 * and .vcf (vCard, as exported by Android / iPhone). Only names and numbers leave the phone.
 */

import { toIntlPhone } from "./phone";

/** raw2: the "Second number" column (or a vCard's second number), when there is one. */
export type RawContact = { name: string; raw: string; raw2?: string };

/** +… kept as written; 10 digits starting 6–9 → +91…; anything else → null ("Could not read"). */
export const normalizeContactPhone = toIntlPhone;

/* ───── CSV ───── */

function csvRows(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  const delim = (text.split("\n")[0].match(/;/g)?.length ?? 0) > (text.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim()));
}

/** Finds the name and phone columns from a header row (or assumes Name, Phone when there is none). */
function fromTable(table: string[][]): RawContact[] {
  if (!table.length) return [];
  const head = table[0].map((h) => h.trim().toLowerCase());
  const find = (re: RegExp, not?: RegExp) => head.findIndex((h) => re.test(h) && !(not && not.test(h)));
  let nameCol = find(/^(name|full name|display name|contact name|customer|customer name)$/);
  const first = find(/^(first name|given name)$/);
  const last = find(/^(last name|family name|surname)$/);
  if (nameCol < 0 && first < 0) nameCol = find(/name/, /(last|family|middle|file|nick|org|company|phonetic)/);
  const SECOND = /(second|2nd|alternate|alt\b|other|phone 2|mobile 2|number 2|tel 2)/;
  let phoneCol = find(/^(phone|mobile|mobile number|phone number|number|contact|contact number|whatsapp|first number|phone 1)$/);
  if (phoneCol < 0) phoneCol = find(/(phone|mobile|number|tel)/, new RegExp(`(type|label|${SECOND.source.slice(1, -1)})`));
  let phone2Col = find(/^(second number|second phone|second mobile|alternate number|alternate phone|alt number|alt phone|other number|phone 2|mobile 2)$/);
  // e.g. Google Contacts "Phone 2 - Value"
  if (phone2Col < 0) phone2Col = head.findIndex((h, i) => i !== phoneCol && SECOND.test(h) && /(phone|mobile|number|tel)/.test(h) && !/(type|label)/.test(h));
  const hasHeader = nameCol >= 0 || first >= 0 || phoneCol >= 0;
  if (!hasHeader) {
    nameCol = 0;
    phoneCol = 1;
  }
  return table.slice(hasHeader ? 1 : 0).flatMap((r) => {
    const name = (nameCol >= 0 ? r[nameCol] : [r[first], last >= 0 ? r[last] : ""].join(" ")).trim().replace(/\s+/g, " ");
    // Google exports put several numbers in one cell: "98461 86713 ::: 0483 2700000"
    const cell = (phoneCol >= 0 ? (r[phoneCol] ?? "") : "").split(/:::|\n/).map((x) => x.trim());
    const raw = cell[0] ?? "";
    const raw2 = ((phone2Col >= 0 ? (r[phone2Col] ?? "") : "").split(/:::|\n/)[0] || cell[1] || "").trim();
    if (!name && !raw) return [];
    return [{ name: name || raw, raw, ...(raw2 ? { raw2 } : {}) }];
  });
}

export function parseCsv(text: string) {
  return fromTable(csvRows(text.replace(/^﻿/, "")));
}

/* ───── XLSX (first sheet) ───── */

export async function parseXlsx(buf: ArrayBuffer): Promise<RawContact[]> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buf);
  const xml = (s: string) => new DOMParser().parseFromString(s, "application/xml");
  const sst: string[] = [];
  const ss = zip.file("xl/sharedStrings.xml");
  if (ss) for (const si of Array.from(xml(await ss.async("string")).getElementsByTagName("si"))) sst.push(Array.from(si.getElementsByTagName("t")).map((t) => t.textContent ?? "").join(""));
  const wbRels = zip.file("xl/_rels/workbook.xml.rels");
  let sheetPath = "xl/worksheets/sheet1.xml";
  const wb = zip.file("xl/workbook.xml");
  if (wb && wbRels) {
    const firstSheet = xml(await wb.async("string")).getElementsByTagName("sheet")[0];
    const rid = firstSheet?.getAttribute("r:id") ?? firstSheet?.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const rel = Array.from(xml(await wbRels.async("string")).getElementsByTagName("Relationship")).find((r) => r.getAttribute("Id") === rid);
    const target = rel?.getAttribute("Target");
    if (target) sheetPath = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  }
  const sheet = zip.file(sheetPath) ?? zip.file(/xl\/worksheets\/sheet\d+\.xml/)[0];
  if (!sheet) return [];
  const col = (ref: string) => ref.replace(/\d+/g, "").split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
  const table: string[][] = [];
  for (const r of Array.from(xml(await sheet.async("string")).getElementsByTagName("row"))) {
    const row: string[] = [];
    for (const c of Array.from(r.getElementsByTagName("c"))) {
      const t = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      const text = t === "s" ? (sst[Number(v)] ?? "") : t === "inlineStr" ? Array.from(c.getElementsByTagName("t")).map((x) => x.textContent).join("") : v;
      // Phone numbers saved as numbers come out like 9846186713 or 9.846186713E9
      row[col(c.getAttribute("r") ?? "A1")] = /^\d+(\.\d+)?E\+?\d+$/i.test(text) ? Number(text).toFixed(0) : text;
    }
    table.push(Array.from(row, (x) => x ?? ""));
  }
  return fromTable(table.filter((r) => r.some((c) => c.trim())));
}

/* ───── VCF ───── */

function decodeQP(s: string) {
  const bytes: number[] = [];
  const t = s.replace(/=\r?\n/g, "");
  for (let i = 0; i < t.length; i++) {
    if (t[i] === "=" && /^[0-9A-F]{2}$/i.test(t.slice(i + 1, i + 3))) {
      bytes.push(parseInt(t.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(...new TextEncoder().encode(t[i]));
  }
  return new TextDecoder().decode(new Uint8Array(bytes));
}

export function parseVcf(text: string): RawContact[] {
  // Join folded lines (RFC 6350: a line starting with a space continues the previous one; QP uses a trailing "=")
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/=\n(?=[^\n])/g, "=")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .map((l) => l.replace(/=/g, ""));
  const out: RawContact[] = [];
  let fn = "";
  let n = "";
  let tels: { v: string; cell: boolean }[] = [];
  for (const line of lines) {
    const i = line.indexOf(":");
    if (i < 0) continue;
    const head = line.slice(0, i).toUpperCase();
    let value = line.slice(i + 1).trim();
    if (head.includes("QUOTED-PRINTABLE")) value = decodeQP(value);
    const prop = head.split(";")[0].replace(/^ITEM\d+\./, "");
    if (prop === "BEGIN") {
      fn = "";
      n = "";
      tels = [];
    } else if (prop === "FN") fn = value;
    else if (prop === "N") n = value.split(";").slice(0, 3).reverse().filter(Boolean).join(" ").replace(/\\,/g, ",");
    else if (prop === "TEL") tels.push({ v: value.replace(/^tel:/i, ""), cell: /CELL|MOBILE|IPHONE/.test(head) });
    else if (prop === "END") {
      const name = (fn || n).replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
      const best = tels.find((t) => t.cell && normalizeContactPhone(t.v)) ?? tels.find((t) => normalizeContactPhone(t.v)) ?? tels[0];
      const second = tels.find((t) => t !== best && normalizeContactPhone(t.v) && normalizeContactPhone(t.v) !== normalizeContactPhone(best?.v));
      if (name || best) out.push({ name: name || best?.v || "", raw: best?.v ?? "", ...(second ? { raw2: second.v } : {}) });
    }
  }
  return out;
}

export async function parseContactFile(file: File): Promise<RawContact[]> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".vcf") || lower.endsWith(".vcard")) return parseVcf(await file.text());
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return parseCsv(await file.text());
  if (lower.endsWith(".xlsx")) return parseXlsx(await file.arrayBuffer());
  throw new Error("Choose a .xlsx, .csv or .vcf file");
}
