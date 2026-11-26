/**
 * Measurement fields per garment type (inches) — from the "Measurements" sheet.
 * key = the name stored in the record's values; en = the label shown.
 * One "Shirt" covers full and half sleeve: everything is entered once, with a separate length for each sleeve.
 */
/**
 * part: the figure is recorded as a part of the whole (e.g. chest measured on the folded garment, centre front
 * to one side = a quarter). Only the typed number is stored; the whole is always worked out for display.
 */
export type GarmentField = { key: string; en: string; ml: string; part?: { factor: number; add: number; whole: string } };

/** On a shirt the back panel is cut this much wider than the front. Fixed — not a setting. */
const SHIRT_BACK_EXTRA = 2;

/**
 * Measurements recorded as a part of the whole — by garment, then field. ONLY these carry a multiplier; every
 * other field on every garment is the full measurement and shows as a plain number. (Confirmed with the cutting
 * master: Shirt chest and waist are taken on the folded garment, centre front to side = a quarter.)
 */
// Shirt chest / waist: front panel = recorded × 2, back panel = front + 2, so the finished shirt's round is
// (recorded × 4) + 2. "shirt round" — the garment's circumference, not the customer's body measurement.
const PART_OF_WHOLE: Record<string, Record<string, { factor: number; add: number; whole: string; en: string; ml: string }>> = {
  Shirt: {
    Chest: { factor: 4, add: SHIRT_BACK_EXTRA, whole: "shirt round", en: "Chest — centre front to side", ml: "നടുവിൽ നിന്ന് ഒരു വശത്തേക്ക്" },
    Waist: { factor: 4, add: SHIRT_BACK_EXTRA, whole: "shirt round", en: "Waist — centre front to side", ml: "നടുവിൽ നിന്ന് ഒരു വശത്തേക്ക്" },
  },
};
export const GARMENTS: Record<string, GarmentField[]> = {
  Shirt: f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Shoulder:തോൾ", "Sleeve full=Sleeve — full:ഫുൾ കൈ നീളം", "Sleeve half=Sleeve — half:ഹാഫ് കൈ നീളം", "Sleeve armpit=Sleeve at armpit:കക്ഷം", "Sleeve elbow=Sleeve at elbow:കൈമുട്ട്", "Neck:കഴുത്ത്", "Cuff:കഫ്"),
  "Pant / Trouser": f("Length:നീളം", "Waist:അര", "Seat:സീറ്റ്", "Thigh:തുട", "Knee:മുട്ട്", "Bottom:ബോട്ടം"),
  "School Uniform Trouser": f("Length:നീളം", "Waist:അര", "Seat:സീറ്റ്", "Thigh:തുട", "Knee:മുട്ട്", "Bottom:ബോട്ടം"),
  "Churidar Top": f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Hip:ഇടുപ്പ്", "Shoulder:തോൾ", "Sleeve:കൈ നീളം", "Armhole:കൈക്കുഴി", "Neck-F:കഴുത്ത് മുൻ", "Neck-B:കഴുത്ത് പിൻ"),
  "Churidar Bottom": f("Waist:അര", "Hip:ഇടുപ്പ്", "Length:നീളം", "Thigh:തുട", "Ankle:കണങ്കാൽ"),
  Blouse: f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Shoulder:തോൾ", "Sleeve:കൈ നീളം", "Armhole:കൈക്കുഴി", "Neck-F:കഴുത്ത് മുൻ", "Neck-B:കഴുത്ത് പിൻ"),
  Frock: f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Hip:ഇടുപ്പ്", "Shoulder:തോൾ", "Sleeve:കൈ നീളം", "Neck:കഴുത്ത്"),
  Other: f("Length:നീളം", "Chest:നെഞ്ച്", "Waist:അര", "Shoulder:തോൾ", "Sleeve:കൈ നീളം"),
};
export const GARMENT_TYPES = Object.keys(GARMENTS);

/** Old garment names (before the shirt merge) still read correctly if one turns up, e.g. from an old backup. */
export const LEGACY_GARMENTS: Record<string, { to: string; sleeve: string }> = {
  "Shirt Full Sleeve": { to: "Shirt", sleeve: "Sleeve full" },
  "Shirt Half Sleeve": { to: "Shirt", sleeve: "Sleeve half" },
};

/** "key=Label:Malayalam" or "Label:Malayalam" (key = label). */
function f(...defs: string[]): GarmentField[] {
  return defs.map((d) => {
    const [head, ml] = d.split(":");
    const [key, en] = head.includes("=") ? head.split("=") : [head, head];
    return { key, en, ml };
  });
}

// Part-of-whole fields get their label and factor here — only for the garment they are listed under
for (const [garment, parts] of Object.entries(PART_OF_WHOLE)) {
  GARMENTS[garment] = GARMENTS[garment].map((fl) => {
    const part = parts[fl.key];
    return part ? { key: fl.key, en: part.en, ml: part.ml, part: { factor: part.factor, add: part.add, whole: part.whole } } : fl;
  });
}

const n2 = (n: number) => String(Math.round(n * 100) / 100);

/** The whole measurement for a part-of-whole field (never stored). */
export function wholeOf(field: GarmentField, value: number | null | undefined) {
  return field.part && value != null && Number.isFinite(value) ? Math.round((value * field.part.factor + field.part.add) * 100) / 100 : null;
}

/** "11.5 (shirt round 48)" for part-of-whole fields, "30.5" for the rest — used on screen, slips and exports. */
export function measureText(field: GarmentField, value: number | null | undefined) {
  if (value == null) return "—";
  const whole = wholeOf(field, value);
  return whole != null ? `${n2(value)} (${field.part!.whole} ${n2(whole)})` : n2(value);
}

/** Fields for a record's garment; unknown garments show whatever values they have. */
export function fieldsFor(garmentType: string, values: Record<string, unknown> = {}): GarmentField[] {
  return GARMENTS[garmentType] ?? f(...Object.keys(values).map((k) => `${k}:`));
}

/** Simple mode: a garment's fields in the order the tape goes (Settings); fields not in the list keep their place at the end. */
export function measuringOrder(garmentType: string, order: Record<string, string[]> | undefined): GarmentField[] {
  const fields = GARMENTS[garmentType] ?? GARMENTS.Other;
  const want = order?.[garmentType] ?? [];
  const pos = (k: string) => {
    const i = want.indexOf(k);
    return i < 0 ? want.length + fields.findIndex((f) => f.key === k) : i;
  };
  return [...fields].sort((a, b) => pos(a.key) - pos(b.key));
}

/**
 * Size chart → a garment's fields. Rows are matched by name (Full Chest → Chest, Sleeve Length → Sleeve full,
 * Front Length → Length, Neck → Neck). A part-of-whole field (Shirt chest = ¼) gets (whole − add) ÷ factor,
 * rounded to the nearest ¼ inch.
 */
const CHART_ROW: Record<string, string[]> = {
  "full chest": ["Chest"],
  chest: ["Chest"],
  "sleeve length": ["Sleeve full", "Sleeve"],
  sleeve: ["Sleeve full", "Sleeve"],
  neck: ["Neck"],
  "front length": ["Length"],
  length: ["Length"],
  waist: ["Waist"],
  shoulder: ["Shoulder"],
};
export function fromSizeChart(garmentType: string, chart: { sizes: string[]; rows: { label: string; values: number[] }[] }, sizeIndex: number) {
  const fields = GARMENTS[garmentType] ?? GARMENTS.Other;
  const out: Record<string, number> = {};
  for (const row of chart.rows) {
    const v = row.values[sizeIndex];
    if (v == null || Number.isNaN(Number(v))) continue;
    const f = (CHART_ROW[row.label.trim().toLowerCase()] ?? []).map((k) => fields.find((x) => x.key === k)).find(Boolean);
    if (!f || out[f.key] != null) continue;
    out[f.key] = f.part ? Math.round(((Number(v) - (f.part.add ?? 0)) / f.part.factor) * 4) / 4 : Number(v);
  }
  return out;
}

/** Big Malayalam name per field key (part-of-whole fields carry a "how to measure" text instead of a name). */
export const KEY_ML: Record<string, string> = {
  Length: "നീളം",
  Chest: "നെഞ്ച്",
  Waist: "അര",
  Shoulder: "തോൾ",
  Seat: "സീറ്റ്",
  Thigh: "തുട",
  Knee: "മുട്ട്",
  Bottom: "ബോട്ടം",
  Hip: "ഇടുപ്പ്",
  Sleeve: "കൈ നീളം",
  Armhole: "കൈക്കുഴി",
  Neck: "കഴുത്ത്",
  Cuff: "കഫ്",
  Ankle: "കണങ്കാൽ",
};
export const mlOf = (f: GarmentField) => (f.part ? (KEY_ML[f.key] ?? f.ml) : f.ml || KEY_ML[f.key] || f.en);
export const enOf = (f: GarmentField) => (f.part ? f.key : f.en);

/** Malayalam for the derived whole of a part-of-whole field ("shirt round"). */
export const WHOLE_ML: Record<string, string> = { "shirt round": "ഷർട്ട് ചുറ്റളവ്" };
