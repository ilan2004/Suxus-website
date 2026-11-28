/* Website order: shirt and / or pant in our fabric, measured on the customer's own well-fitting garment laid flat
   (never on the body). The keys and ranges match the ERP (erp/src/lib/web-order.ts) — change both together. */

export type Unit = "in" | "cm";
export type Garment = "Shirt" | "Pant";
export type SleeveType = "full" | "half";
export type PocketChoice = "none" | "one" | "two";
export type PantModel = "Regular" | "Loose";

export const CM_PER_INCH = 2.54;
/** SUXUS chest / waist: the figure × 4 + 2 inches back allowance = the shirt's round. */
export const BACK_ALLOWANCE_IN = 2;

export type Diagram = "shirtFront" | "shirtHalf" | "shirtBack" | "collar" | "pant";

export type Field = {
  key: string;
  garment: Garment;
  /** shown only for this sleeve type */
  sleeve?: SleeveType;
  en: string;
  ml: string;
  start: { en: string; ml: string };
  end: { en: string; ml: string };
  how: string;
  diagram: Diagram;
  /** what the figure becomes (shown to the customer as they type) */
  calc?: { label: string; ml: string; of: (v: number, unit: Unit) => number };
  /** plausible range in inches */
  range: [number, number];
};

const round4 = (v: number, unit: Unit) => v * 4 + (unit === "cm" ? BACK_ALLOWANCE_IN * CM_PER_INCH : BACK_ALLOWANCE_IN);
const twice = (v: number) => v * 2;

export const SHIRT_FIELDS: Field[] = [
  {
    key: "chestQ",
    garment: "Shirt",
    en: "Chest",
    ml: "നെഞ്ച്",
    start: { en: "Button placket — outer edge", ml: "ബട്ടൺ പ്ലാക്കറ്റിന്റെ പുറത്തെ എഡ്ജ്" },
    end: { en: "Underarm seam", ml: "കക്ഷത്തിന് താഴെയുള്ള സ്റ്റിച്ചിംഗ്" },
    how: "എല്ലാ ബട്ടണും ഇട്ട് ഷർട്ട് നിരപ്പായി വിരിക്കുക. ബട്ടൺ ഭാഗത്തെ പ്ലാക്കറ്റിന്റെ പുറത്തെ എഡ്ജിൽ നിന്ന് (നടുവിൽ നിന്നല്ല) കക്ഷത്തിന് താഴെയുള്ള സ്റ്റിച്ചിംഗ് വരെ നേരെ അളക്കുക.",
    diagram: "shirtFront",
    calc: { label: "Chest round (× 4 + 2″ back)", ml: "നെഞ്ച് ചുറ്റളവ്", of: round4 },
    range: [7, 20],
  },
  {
    key: "lenShoulder",
    garment: "Shirt",
    en: "Length — from shoulder",
    ml: "നീളം — തോളിൽ നിന്ന്",
    start: { en: "Shoulder seam (sleeve join)", ml: "തോളും കൈയും ചേരുന്ന സ്റ്റിച്ചിംഗ്" },
    end: { en: "Bottom hem", ml: "ഷർട്ടിന്റെ താഴത്തെ അറ്റം" },
    how: "തോളും സ്ലീവും ചേരുന്ന സ്റ്റിച്ചിംഗ് പോയിന്റിൽ നിന്ന് ഷർട്ടിന്റെ താഴത്തെ അറ്റം വരെ നേരെ അളക്കുക.",
    diagram: "shirtFront",
    range: [20, 40],
  },
  {
    key: "lenCentre",
    garment: "Shirt",
    en: "Length — centre",
    ml: "നീളം — നടുവിൽ",
    start: { en: "Top button centre", ml: "മുകളിലെ ബട്ടൺ സെന്റർ" },
    end: { en: "Bottom hem", ml: "താഴത്തെ അറ്റം" },
    how: "ഷർട്ടിന്റെ നടുവിലുള്ള മുകളിലെ ബട്ടൺ സെന്ററിൽ നിന്ന് താഴത്തെ അറ്റം വരെ അളക്കുക.",
    diagram: "shirtFront",
    range: [15, 36],
  },
  {
    key: "lenUnderarm",
    garment: "Shirt",
    en: "Length — from underarm",
    ml: "നീളം — കക്ഷത്തിൽ നിന്ന്",
    start: { en: "Underarm seam", ml: "കക്ഷത്തിന് താഴെയുള്ള സ്റ്റിച്ചിംഗ്" },
    end: { en: "Bottom hem (side)", ml: "വശത്തെ താഴത്തെ അറ്റം" },
    how: "കക്ഷത്തിന് താഴെ സ്റ്റിച്ചിംഗ് ചേരുന്ന ഭാഗത്തുനിന്ന് വശത്തുകൂടി ഷർട്ടിന്റെ താഴത്തെ അറ്റം വരെ അളക്കുക.",
    diagram: "shirtFront",
    range: [10, 30],
  },
  {
    key: "shoulder",
    garment: "Shirt",
    en: "Shoulder",
    ml: "തോൾ",
    start: { en: "Left shoulder seam", ml: "ഇടത് ഷോൾഡർ സീം" },
    end: { en: "Right shoulder seam", ml: "വലത് ഷോൾഡർ സീം" },
    how: "ഷർട്ടിന്റെ പിൻഭാഗം മുകളിലാക്കി നിരപ്പായി വയ്ക്കുക. ഇടത് ഷോൾഡർ സീം മുതൽ വലത് ഷോൾഡർ സീം വരെ നേരെ അളക്കുക.",
    diagram: "shirtBack",
    range: [12, 26],
  },
  {
    key: "sleeveFull",
    garment: "Shirt",
    sleeve: "full",
    en: "Full sleeve length",
    ml: "ഫുൾ കൈ നീളം",
    start: { en: "Shoulder seam (sleeve join)", ml: "ഷോൾഡർ സീം" },
    end: { en: "Cuff edge", ml: "കഫിന്റെ അറ്റം" },
    how: "ഷോൾഡർ സീം മുതൽ കഫിന്റെ അറ്റം വരെ സ്ലീവിന്റെ പുറംവശത്തുകൂടി അളക്കുക.",
    diagram: "shirtFront",
    range: [16, 30],
  },
  {
    key: "cuffW",
    garment: "Shirt",
    sleeve: "full",
    en: "Cuff width",
    ml: "കഫ് വീതി",
    start: { en: "Cuff — one edge", ml: "കഫിന്റെ ഒരു അറ്റം" },
    end: { en: "Cuff — other edge", ml: "മറുവശത്തെ അറ്റം" },
    how: "കഫിന്റെ ബട്ടൺ ഇട്ട് അടച്ച് നിരപ്പായി വയ്ക്കുക. ഒരു അറ്റത്തുനിന്ന് മറുവശത്തെ അറ്റം വരെ വീതി അളക്കുക.",
    diagram: "shirtFront",
    calc: { label: "Cuff round (× 2)", ml: "കഫ് ചുറ്റളവ്", of: twice },
    range: [3.5, 7],
  },
  {
    key: "sleeveHalf",
    garment: "Shirt",
    sleeve: "half",
    en: "Half sleeve length",
    ml: "ഹാഫ് കൈ നീളം",
    start: { en: "Shoulder seam (sleeve join)", ml: "ഷോൾഡർ സീം" },
    end: { en: "Sleeve hem", ml: "ഹാഫ് സ്ലീവിന്റെ താഴത്തെ അറ്റം" },
    how: "ഷോൾഡർ സീം മുതൽ ഹാഫ് സ്ലീവിന്റെ താഴത്തെ അറ്റം വരെ അളക്കുക.",
    diagram: "shirtHalf",
    range: [5, 14],
  },
  {
    key: "halfEndW",
    garment: "Shirt",
    sleeve: "half",
    en: "Half sleeve end width",
    ml: "ഹാഫ് സ്ലീവ് അറ്റത്തെ വീതി",
    start: { en: "Sleeve hem — one side", ml: "സ്ലീവ് അറ്റം — ഒരു വശം" },
    end: { en: "Sleeve hem — other side", ml: "മറുവശം" },
    how: "സ്ലീവിന്റെ താഴത്തെ അറ്റം നിരപ്പായി വയ്ക്കുക. ഒരു വശത്തുനിന്ന് മറുവശം വരെ വീതി അളക്കുക (× 2 വേണ്ട).",
    diagram: "shirtHalf",
    range: [4, 10],
  },
  {
    key: "upperSleeveW",
    garment: "Shirt",
    en: "Upper sleeve width",
    ml: "കൈയുടെ മുകൾഭാഗം വീതി",
    start: { en: "Sleeve — outer fold", ml: "സ്ലീവിന്റെ പുറത്തെ മടക്ക്" },
    end: { en: "Sleeve — underarm side", ml: "കക്ഷ ഭാഗത്തെ അറ്റം" },
    how: "ഷർട്ട് നിരപ്പായി വിരിക്കുക. സ്ലീവിന്റെ മുകൾഭാഗത്ത് (ബൈസെപ്സ് ഭാഗം) ഒരു വശത്തുനിന്ന് മറുവശം വരെ നേരെ അളക്കുക. കൈയിൽ ടേപ്പ് ചുറ്റിയല്ല.",
    diagram: "shirtFront",
    calc: { label: "Upper sleeve round (× 2)", ml: "ചുറ്റളവ്", of: twice },
    range: [4, 11],
  },
  {
    key: "collar",
    garment: "Shirt",
    en: "Collar",
    ml: "കോളർ",
    start: { en: "Collar button centre", ml: "കോളർ ബട്ടൺ സെന്റർ" },
    end: { en: "Buttonhole centre", ml: "ബട്ടൺ ഹോൾ സെന്റർ" },
    how: "കോളർ തുറന്ന് നിരപ്പായി വയ്ക്കുക. കോളർ ബട്ടണിന്റെ നടുവിൽ നിന്ന് ബട്ടൺ ഹോളിന്റെ നടുവരെ അളക്കുക.",
    diagram: "collar",
    range: [12, 22],
  },
  {
    key: "waistQ",
    garment: "Shirt",
    en: "Waist",
    ml: "അര",
    start: { en: "Button placket — outer edge (at the waist)", ml: "അരയുടെ നിരപ്പിൽ ബട്ടൺ പ്ലാക്കറ്റിന്റെ പുറത്തെ എഡ്ജ്" },
    end: { en: "Side seam", ml: "വശത്തെ സ്റ്റിച്ചിംഗ്" },
    how: "നെഞ്ച് അളന്ന അതേ രീതിയിൽ, അരയുടെ നിരപ്പിൽ ബട്ടൺ പ്ലാക്കറ്റിന്റെ പുറത്തെ എഡ്ജിൽ നിന്ന് വശത്തെ സ്റ്റിച്ചിംഗ് വരെ അളക്കുക.",
    diagram: "shirtFront",
    calc: { label: "Waist round (× 4 + 2″ back)", ml: "അര ചുറ്റളവ്", of: round4 },
    range: [7, 20],
  },
];

export const PANT_FIELDS: Field[] = [
  {
    key: "length",
    garment: "Pant",
    en: "Length",
    ml: "നീളം",
    start: { en: "Top of the waistband", ml: "അരപ്പട്ടയുടെ മുകൾഭാഗം" },
    end: { en: "Hem", ml: "താഴത്തെ അറ്റം" },
    how: "ബട്ടണും സിപ്പും ഇട്ട് പാന്റ് നിരപ്പായി വിരിക്കുക. അരപ്പട്ടയുടെ മുകളിൽ നിന്ന് പുറംവശത്തുകൂടി താഴത്തെ അറ്റം വരെ അളക്കുക.",
    diagram: "pant",
    range: [26, 48],
  },
  {
    key: "waistW",
    garment: "Pant",
    en: "Waist",
    ml: "അര",
    start: { en: "Waistband — left edge", ml: "അരപ്പട്ട — ഇടത് അറ്റം" },
    end: { en: "Waistband — right edge", ml: "വലത് അറ്റം" },
    how: "അരപ്പട്ട ഒരു അറ്റത്തുനിന്ന് മറ്റേ അറ്റം വരെ നേരെ അളക്കുക.",
    diagram: "pant",
    calc: { label: "Waist round (× 2)", ml: "ചുറ്റളവ്", of: twice },
    range: [11, 28],
  },
  {
    key: "seatW",
    garment: "Pant",
    en: "Seat",
    ml: "സീറ്റ്",
    start: { en: "Seat — left side", ml: "സീറ്റ് — ഇടത് വശം" },
    end: { en: "Seat — right side", ml: "വലത് വശം" },
    how: "സിപ്പിന്റെ താഴത്തെ അറ്റത്തിന്റെ നിരപ്പിൽ (ഏറ്റവും വീതിയുള്ള ഭാഗം) ഒരു വശത്തുനിന്ന് മറുവശം വരെ അളക്കുക.",
    diagram: "pant",
    calc: { label: "Seat round (× 2)", ml: "ചുറ്റളവ്", of: twice },
    range: [15, 32],
  },
  {
    key: "thighW",
    garment: "Pant",
    en: "Thigh",
    ml: "തുട",
    start: { en: "One leg — outer side", ml: "ഒരു കാൽ — പുറംവശം" },
    end: { en: "Inner side, just below the crotch", ml: "അകംവശം, കവടിക്ക് തൊട്ടുതാഴെ" },
    how: "ഒരു കാലിന്റെ, കവടിക്ക് (crotch) തൊട്ടുതാഴെ പുറംവശത്തുനിന്ന് അകംവശം വരെ വീതി അളക്കുക.",
    diagram: "pant",
    calc: { label: "Thigh round (× 2)", ml: "ചുറ്റളവ്", of: twice },
    range: [8, 18],
  },
  {
    key: "kneeW",
    garment: "Pant",
    en: "Knee",
    ml: "മുട്ട്",
    start: { en: "One leg at the knee — outer", ml: "മുട്ടിന്റെ നിരപ്പിൽ — പുറംവശം" },
    end: { en: "Inner side", ml: "അകംവശം" },
    how: "ഒരു കാലിന്റെ മുട്ടിന്റെ നിരപ്പിൽ ഒരു വശത്തുനിന്ന് മറുവശം വരെ വീതി അളക്കുക.",
    diagram: "pant",
    calc: { label: "Knee round (× 2)", ml: "ചുറ്റളവ്", of: twice },
    range: [6, 14],
  },
  {
    key: "bottomW",
    garment: "Pant",
    en: "Bottom",
    ml: "ബോട്ടം",
    start: { en: "Hem — one side", ml: "താഴത്തെ അറ്റം — ഒരു വശം" },
    end: { en: "Hem — other side", ml: "മറുവശം" },
    how: "ഒരു കാലിന്റെ താഴത്തെ അറ്റം ഒരു വശത്തുനിന്ന് മറുവശം വരെ വീതി അളക്കുക.",
    diagram: "pant",
    calc: { label: "Bottom round (× 2)", ml: "ചുറ്റളവ്", of: twice },
    range: [5, 12],
  },
];

export const fieldsFor = (g: Garment, sleeve: SleeveType) => (g === "Shirt" ? SHIRT_FIELDS.filter((f) => !f.sleeve || f.sleeve === sleeve) : PANT_FIELDS);

export const toInches = (v: number, unit: Unit) => (unit === "cm" ? v / CM_PER_INCH : v);
export const convert = (v: number, from: Unit, to: Unit) => (from === to ? v : to === "cm" ? v * CM_PER_INCH : v / CM_PER_INCH);
export const fmt = (n: number) => String(Math.round(n * 100) / 100);
export const inRange = (f: Field, v: number, unit: Unit) => {
  const i = toInches(v, unit);
  return i >= f.range[0] && i <= f.range[1];
};
