/**
 * Fabric requirement — how many metres a garment needs before cutting. An ESTIMATE for cutting and for checking
 * stock; stock is still reduced only by the bill.
 *
 * The figures live in Settings → Fabric requirement (editable). A band row means "above the previous row's limit, up
 * to `upTo` inches" (the last row has no limit). Figures are per piece, for a fabric width (default 58 in).
 *
 * Shirt: look up BOTH tables — by recorded chest (the quarter, not the shirt round) and by shirt length — and take the
 * HIGHER figure. A tall thin man needs the length figure, a short heavy man the chest figure.
 * Pant / trouser: Regular or Loose model (the measurement's fit).
 */
export type BandRow = { width: number; upTo: number | null; full: number; half: number };
export type PantRow = { width: number; model: "Regular" | "Loose"; metres: number };
export type FabricRequirementTables = { shirtChest: BandRow[]; shirtLength: BandRow[]; pant: PantRow[] };

export const DEFAULT_WIDTH = 58;

/** As given by the shop (58 inch fabric). */
export const DEFAULT_FABRIC_REQUIREMENT: FabricRequirementTables = {
  shirtChest: [
    { width: 58, upTo: 12, full: 1.5, half: 1.3 },
    { width: 58, upTo: 13.5, full: 1.6, half: 1.4 },
    { width: 58, upTo: null, full: 1.8, half: 1.6 },
  ],
  shirtLength: [
    { width: 58, upTo: 29, full: 1.5, half: 1.3 },
    { width: 58, upTo: 31, full: 1.6, half: 1.4 },
    { width: 58, upTo: 33, full: 1.7, half: 1.5 },
    { width: 58, upTo: null, full: 1.8, half: 1.6 },
  ],
  pant: [
    { width: 58, model: "Regular", metres: 1.3 },
    { width: 58, model: "Loose", metres: 1.5 },
  ],
};

export type Sleeve = "full" | "half";
export type Requirement =
  /** metres per piece and for the whole item (× qty), and which rule decided it */
  | { ok: true; perPiece: number; total: number; rule: string; ruleEn: string; sleeve?: Sleeve; sleeveGuessed?: boolean; halfPerPiece?: number }
  /** a measurement the tables need is missing */
  | { ok: false; missing: string; missingEn: string };

const n2 = (x: number) => (Math.round(x * 100) / 100).toFixed(2);
const inch = (x: number) => String(Math.round(x * 100) / 100);

/** Rows for one width, sorted by limit (no limit last). */
function bandsFor(rows: BandRow[], width: number) {
  const mine = rows.filter((r) => r.width === width);
  const use = mine.length ? mine : rows.filter((r) => r.width === DEFAULT_WIDTH);
  return [...use].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
}
function bandFigure(rows: BandRow[], width: number, value: number, sleeve: Sleeve) {
  const row = bandsFor(rows, width).find((r) => r.upTo == null || value <= r.upTo);
  return row ? row[sleeve] : null;
}

/** Which garment table applies to an order item name ("Shirt", "School Shirt" → shirt; "Pant", "School Pant" → pant). */
export function tableKindOf(item: string): "shirt" | "pant" | null {
  const i = item.toLowerCase();
  if (/shirt/.test(i) && !/t-shirt|tshirt/.test(i) && !/pant/.test(i)) return "shirt";
  if (/pant|trouser/.test(i) && !/shirt/.test(i)) return "pant";
  return null;
}

/** "Full" / "Half" in the item name, else the record: only one sleeve length entered tells which; else not known. */
export function sleeveOf(item: string, values: Record<string, number | null> | undefined): Sleeve | null {
  if (/half/i.test(item)) return "half";
  if (/full/i.test(item)) return "full";
  const full = values?.["Sleeve full"] != null;
  const half = values?.["Sleeve half"] != null;
  if (full && !half) return "full";
  if (half && !full) return "half";
  return null;
}

/**
 * The requirement for one order item, from the person's latest measurement of that garment.
 * Returns null for garments the tables do not cover (no line is shown for them).
 */
export function fabricRequirement(
  tables: FabricRequirementTables,
  item: string,
  qty: number,
  m: { values: Record<string, number | null>; fit?: string | null } | null | undefined,
  width = DEFAULT_WIDTH,
): Requirement | null {
  const kind = tableKindOf(item);
  if (!kind) return null;
  const pieces = Math.max(1, qty || 1);
  if (kind === "pant") {
    const loose = (m?.fit ?? "").toLowerCase() === "loose";
    const model = loose ? "Loose" : "Regular";
    const rows = tables.pant.filter((r) => r.width === width);
    const row = (rows.length ? rows : tables.pant.filter((r) => r.width === DEFAULT_WIDTH)).find((r) => r.model === model);
    if (!row) return { ok: false, missing: "പട്ടികയിൽ ഇല്ല", missingEn: `no ${model} figure in Settings` };
    return { ok: true, perPiece: row.metres, total: row.metres * pieces, rule: loose ? "ലൂസ് മോഡൽ" : "സാധാരണ മോഡൽ", ruleEn: `${model} model` };
  }
  // Shirt: both tables, the higher figure wins
  const chest = m?.values?.Chest ?? null;
  const length = m?.values?.Length ?? null;
  if (chest == null || length == null) {
    const what = [chest == null && ["നെഞ്ചളവ്", "chest"], length == null && ["നീളം", "length"]].filter(Boolean) as string[][];
    return { ok: false, missing: `അളവ് ഇല്ല (${what.map((w) => w[0]).join(", ")})`, missingEn: `no ${what.map((w) => w[1]).join(" / ")} measurement` };
  }
  const known = sleeveOf(item, m?.values);
  // Not known which sleeve: the full-sleeve figure is used for totals and warnings (the larger), and both are shown
  const sleeve: Sleeve = known ?? "full";
  const byChest = bandFigure(tables.shirtChest, width, chest, sleeve);
  const byLength = bandFigure(tables.shirtLength, width, length, sleeve);
  if (byChest == null || byLength == null) return { ok: false, missing: "പട്ടികയിൽ ഇല്ല", missingEn: "the Settings table has no row for this size" };
  const perPiece = Math.max(byChest, byLength);
  const rule =
    byChest === byLength ? `നെഞ്ചളവ് ${inch(chest)}, നീളം ${inch(length)} — രണ്ടും` : byChest > byLength ? `നെഞ്ചളവ് ${inch(chest)} പ്രകാരം` : `നീളം ${inch(length)} പ്രകാരം`;
  const ruleEn = byChest === byLength ? `chest ${inch(chest)} and length ${inch(length)} — both` : byChest > byLength ? `by chest ${inch(chest)}` : `by length ${inch(length)}`;
  const half = known ? undefined : Math.max(bandFigure(tables.shirtChest, width, chest, "half") ?? 0, bandFigure(tables.shirtLength, width, length, "half") ?? 0);
  return { ok: true, perPiece, total: perPiece * pieces, rule, ruleEn, sleeve, sleeveGuessed: !known, halfPerPiece: half };
}

/** "തുണി വേണ്ടത്: 1.70 മീറ്റർ" (+ "2 × 1.70" for several pieces). */
export function requirementText(r: Extract<Requirement, { ok: true }>, qty: number) {
  return `തുണി വേണ്ടത്: ${n2(r.total)} മീറ്റർ${qty > 1 ? ` (${qty} × ${n2(r.perPiece)})` : ""}`;
}
export const metres = n2;

/** Short-stock warning (warn only): "ഈ തുണി 1.2 മീറ്ററേ ഉള്ളൂ. 1.70 മീറ്റർ വേണം." */
export function shortText(available: number, need: number) {
  return `ഈ തുണി ${inch(Math.max(0, available))} മീറ്ററേ ഉള്ളൂ. ${n2(need)} മീറ്റർ വേണം.`;
}

/** Order item name → the measurement garment types it uses ("Shirt" ↔ "Shirt", "School Pant" ↔ "Pant / Trouser" …). */
export function garmentTypesFor(item: string, garments: string[]) {
  const it = item.toLowerCase();
  const exact = garments.filter((g) => g.toLowerCase() === it);
  if (exact.length) return exact;
  const words = (s: string) => s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4);
  return garments.filter((g) => words(g).some((w) => it.includes(w)) || words(item).some((w) => g.toLowerCase().includes(w)));
}

export type ReqMeasure = { wearerId: number | null; garmentType: string; values: Record<string, number | null>; fit: string | null; date: string };

/** The measurement an order item is cut to: same person, matching garment, the latest. */
export function measureFor(measures: ReqMeasure[], item: string, wearerId: number | null, selfId: number | null) {
  const mine = measures.filter((m) => (m.wearerId ?? selfId) === (wearerId ?? selfId));
  const types = garmentTypesFor(item, [...new Set(mine.map((m) => m.garmentType))]);
  return mine.filter((m) => types.includes(m.garmentType)).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

