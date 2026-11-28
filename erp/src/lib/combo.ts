/**
 * Shirt + trouser combinations: which trouser fabrics FROM OUR OWN STOCK go with a chosen shirt fabric, each with a
 * fixed Malayalam reason and an occasion tag. Pure colour logic on the fabric's stored dominant colour — no AI call,
 * no cost, instant, works with the try-on key switched off. Used by the try-on page, the fabric page and Settings.
 *
 * 1. Every fabric gets a colour bucket from its dominant hex (HSL), unless the owner picked one in Settings.
 * 2. The pairing table lists the trouser buckets for each shirt bucket, best first.
 * 3. Blocking rules: pattern shirt → plain trousers only; never the same bucket (black on black is fine);
 *    never navy with mid blue; never two brights. Stock, trouser suitability and "not the same fabric" come first.
 * Fewer than two left → show what is left with a line; never pad the list with a bad pair.
 */

export const BUCKETS = [
  "NEUTRAL_LIGHT",
  "CREAM_BEIGE",
  "PASTEL",
  "DARK_NEUTRAL",
  "NAVY",
  "GREY",
  "KHAKI_BEIGE",
  "BROWN",
  "GREEN_OLIVE",
  "MID_BLUE",
  "MAROON",
  "BRIGHT",
] as const;
export type Bucket = (typeof BUCKETS)[number];
export const isBucket = (v: unknown): v is Bucket => typeof v === "string" && (BUCKETS as readonly string[]).includes(v);

export const BUCKET_LABEL: Record<Bucket, { ml: string; en: string }> = {
  NEUTRAL_LIGHT: { ml: "വെള്ള / ഓഫ്-വൈറ്റ്", en: "White / off-white" },
  CREAM_BEIGE: { ml: "ക്രീം / ബീജ്", en: "Cream / beige" },
  PASTEL: { ml: "ഇളം നിറം", en: "Pastel" },
  DARK_NEUTRAL: { ml: "ബ്ലാക്ക് / ചാർക്കോൾ", en: "Black / charcoal" },
  NAVY: { ml: "നേവി", en: "Navy" },
  GREY: { ml: "ഗ്രേ", en: "Grey" },
  KHAKI_BEIGE: { ml: "കാക്കി", en: "Khaki / beige" },
  BROWN: { ml: "ബ്രൗൺ", en: "Brown" },
  GREEN_OLIVE: { ml: "പച്ച / ഒലിവ്", en: "Green / olive" },
  MID_BLUE: { ml: "നീല", en: "Mid blue" },
  MAROON: { ml: "മറൂൺ", en: "Maroon" },
  BRIGHT: { ml: "തിളങ്ങുന്ന നിറം", en: "Bright" },
};

/** What a fabric can be stitched into. Existing fabrics start as "both"; the owner corrects them in Settings. */
export const SUITABLE = ["shirting", "suiting", "both"] as const;
export type Suitable = (typeof SUITABLE)[number];
export const isSuitable = (v: unknown): v is Suitable => typeof v === "string" && (SUITABLE as readonly string[]).includes(v);
export const SUITABLE_LABEL: Record<Suitable, { ml: string; en: string }> = {
  shirting: { ml: "ഷർട്ടിങ് മാത്രം", en: "Shirting only" },
  suiting: { ml: "സ്യൂട്ടിങ് / പാൻറ്റ്", en: "Suiting / trousering" },
  both: { ml: "Type അനുസരിച്ച്", en: "As per Type" },
};

/* ───────────────────────── Step 1: bucket from the hex ───────────────────────── */

export function hsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: Math.min(1, s), l };
}

/**
 * The owner's table — the first rule that matches decides. "Anything with saturation >= 0.65 and lightness 0.40-0.70
 * is BRIGHT" is checked before the hue rules (otherwise an orange would be khaki). Two additions, both for colours the
 * table leaves open: (a) below 15% saturation the hue means nothing (a charcoal has a "blue" hue), so a nearly
 * colourless fabric is charcoal (dark) or grey by lightness alone; (b) a colour no rule covers is cream when light and
 * warm (HSL overstates the saturation of near-whites), pastel when light (lavender), and bright otherwise (red, teal) —
 * all pair only with safe trousers. The owner can override any fabric in Settings.
 */
export function autoBucket(hex: string | null | undefined): Bucket | null {
  if (!hex) return null;
  const c = hsl(hex);
  if (!c) return null;
  const { h, s, l } = c;
  const hueIn = (a: number, b: number) => h >= a && h <= b;
  if (l >= 0.88 && s <= 0.12) return "NEUTRAL_LIGHT";
  if (l >= 0.75 && s <= 0.3) return hueIn(20, 60) ? "CREAM_BEIGE" : "PASTEL";
  if (l <= 0.2) return "DARK_NEUTRAL";
  if (s < 0.15) return l <= 0.35 ? "DARK_NEUTRAL" : "GREY";
  if (l <= 0.35 && hueIn(200, 250)) return "NAVY";
  if (l >= 0.35 && l <= 0.7 && s <= 0.18) return "GREY";
  if (s >= 0.65 && l >= 0.4 && l <= 0.7) return "BRIGHT";
  if (hueIn(20, 45) && l >= 0.45 && l <= 0.75) return "KHAKI_BEIGE";
  if (hueIn(20, 45) && l >= 0.25 && l < 0.45) return "BROWN";
  if (hueIn(60, 150)) return "GREEN_OLIVE";
  if (hueIn(200, 250) && l >= 0.35 && l <= 0.7) return "MID_BLUE";
  if ((h >= 330 || h <= 15) && l <= 0.4) return "MAROON";
  if (l >= 0.6) return hueIn(20, 60) ? "CREAM_BEIGE" : "PASTEL";
  return "BRIGHT";
}

/** The owner's choice wins; never overwritten by the automatic guess. */
export const bucketOf = (f: { hex: string | null; bucketOverride?: string | null }): Bucket | null =>
  isBucket(f.bucketOverride) ? f.bucketOverride : autoBucket(f.hex);

/* ───────────────────────── Step 2: the pairing table, with fixed reasons ───────────────────────── */

export type Occasion = "office" | "wedding" | "casual" | "uniform";
export const OCCASION_LABEL: Record<Occasion, { ml: string; en: string }> = {
  office: { ml: "ഓഫീസ്", en: "Office" },
  wedding: { ml: "കല്യാണം", en: "Wedding" },
  casual: { ml: "സാധാരണ", en: "Casual" },
  uniform: { ml: "യൂണിഫോം", en: "Uniform" },
};

type Pair = { to: Bucket; ml: string; en: string; occasion: Occasion };
const p = (to: Bucket, occasion: Occasion, ml: string, en: string): Pair => ({ to, ml, en, occasion });

/** Shirt bucket → trouser buckets, best first. Reason lines are fixed text (never generated), each under 9 words. */
export const PAIRS: Record<Bucket, Pair[]> = {
  NEUTRAL_LIGHT: [
    p("DARK_NEUTRAL", "wedding", "വൈറ്റ് ഷർട്ടിന് ബ്ലാക്ക് പാൻറ്റ് — എപ്പോഴും ചേരുന്ന കോംബോ.", "White with black — a combination that always works."),
    p("NAVY", "office", "ഓഫീസിനും ഫങ്ഷനും നല്ലത്.", "Good for office and functions."),
    p("KHAKI_BEIGE", "casual", "സാധാരണ ഉപയോഗത്തിന്, ഒതുങ്ങിയ ലുക്ക്.", "For everyday wear, a neat look."),
    p("BROWN", "office", "വൈറ്റിന് ബ്രൗൺ — ഭംഗിയുള്ള, ഒതുങ്ങിയ ലുക്ക്.", "White with brown — smart and neat."),
    p("GREY", "office", "വൈറ്റ് ഷർട്ടിന് ഗ്രേ — വൃത്തിയുള്ള ഫോർമൽ ലുക്ക്.", "White with grey — a clean formal look."),
  ],
  CREAM_BEIGE: [
    p("BROWN", "office", "ക്രീം ഷർട്ടിന് ബ്രൗൺ — നാടൻ ഭംഗി.", "Cream with brown — a warm classic."),
    p("GREEN_OLIVE", "casual", "ക്രീമിന് ഒലിവ് — ഇളം, സാധാരണ ലുക്ക്.", "Cream with olive — easy and casual."),
    p("NAVY", "office", "ക്രീം ഷർട്ടിന് നേവി — ഓഫീസിനും ഫങ്ഷനും.", "Cream with navy — office and functions."),
    p("DARK_NEUTRAL", "office", "ക്രീമിന് ബ്ലാക്ക് — തെളിഞ്ഞ ഫോർമൽ കോംബോ.", "Cream with black — a sharp formal pair."),
  ],
  PASTEL: [
    p("NAVY", "office", "ഇളം നിറത്തിന് നേവി — ഓഫീസിന് ഉത്തമം.", "Pastel with navy — ideal for the office."),
    p("GREY", "office", "ഇളം നിറത്തിന് ഗ്രേ — മൃദുവായ ഫോർമൽ ലുക്ക്.", "Pastel with grey — a soft formal look."),
    p("DARK_NEUTRAL", "office", "ഇളം ഷർട്ടിന് ബ്ലാക്ക് — നിറം തെളിഞ്ഞുനിൽക്കും.", "Pastel with black — the colour stands out."),
  ],
  MID_BLUE: [
    p("KHAKI_BEIGE", "casual", "നീല ഷർട്ടിന് കാക്കി — സാധാരണ ഉപയോഗത്തിന് മികച്ചത്.", "Blue with khaki — great for everyday."),
    p("GREY", "office", "നീലയ്ക്ക് ഗ്രേ — ഒതുങ്ങിയ ഓഫീസ് ലുക്ക്.", "Blue with grey — a neat office look."),
    p("DARK_NEUTRAL", "office", "നീല ഷർട്ടിന് ബ്ലാക്ക് — ഫോർമൽ, വൃത്തിയുള്ളത്.", "Blue with black — formal and clean."),
  ],
  NAVY: [
    p("GREY", "office", "നേവി ഷർട്ടിന് ഗ്രേ പാൻറ്റ് — ഒതുങ്ങിയതും ഫോർമലും.", "Navy with grey — neat and formal."),
    p("KHAKI_BEIGE", "casual", "നേവിക്ക് കാക്കി — സാധാരണ ദിവസങ്ങൾക്ക് മികച്ചത്.", "Navy with khaki — great for everyday."),
    p("DARK_NEUTRAL", "office", "നേവി ഷർട്ടിന് ബ്ലാക്ക് — ഗൗരവമുള്ള ലുക്ക്.", "Navy with black — a serious look."),
  ],
  GREY: [
    p("NAVY", "office", "ഗ്രേ ഷർട്ടിന് നേവി — ഓഫീസിന് ഉത്തമം.", "Grey with navy — ideal for the office."),
    p("DARK_NEUTRAL", "office", "ഗ്രേക്ക് ബ്ലാക്ക് — ഒതുങ്ങിയ, ഗൗരവമുള്ള ലുക്ക്.", "Grey with black — neat and serious."),
    p("KHAKI_BEIGE", "casual", "ഗ്രേക്ക് കാക്കി — സാധാരണ ഉപയോഗത്തിന്.", "Grey with khaki — for everyday wear."),
  ],
  GREEN_OLIVE: [
    p("DARK_NEUTRAL", "office", "പച്ച ഷർട്ടിന് ബ്ലാക്ക് — നിറം തെളിയും.", "Green with black — the colour shows."),
    p("KHAKI_BEIGE", "casual", "പച്ചയ്ക്ക് കാക്കി — സാധാരണ, ഇളം ലുക്ക്.", "Green with khaki — easy and casual."),
    p("BROWN", "casual", "പച്ചയ്ക്ക് ബ്രൗൺ — മണ്ണിന്റെ നിറമുള്ള കോംബോ.", "Green with brown — earthy colours."),
  ],
  MAROON: [
    p("DARK_NEUTRAL", "wedding", "മറൂണിന് ബ്ലാക്ക് — ഫങ്ഷന് പറ്റിയ കോംബോ.", "Maroon with black — right for functions."),
    p("GREY", "office", "മറൂണിന് ഗ്രേ — ഒതുങ്ങിയ ഫോർമൽ ലുക്ക്.", "Maroon with grey — a neat formal look."),
    p("KHAKI_BEIGE", "casual", "മറൂണിന് കാക്കി — സാധാരണ ഉപയോഗത്തിന്.", "Maroon with khaki — for everyday wear."),
  ],
  BROWN: [
    p("CREAM_BEIGE", "casual", "ബ്രൗൺ ഷർട്ടിന് ക്രീം — ഇളം, ഭംഗിയുള്ള കോംബോ.", "Brown with cream — light and smart."),
    p("KHAKI_BEIGE", "casual", "ബ്രൗണിന് കാക്കി — സാധാരണ ദിവസങ്ങൾക്ക്.", "Brown with khaki — for everyday."),
    p("DARK_NEUTRAL", "office", "ബ്രൗണിന് ബ്ലാക്ക് — ഇരുണ്ട ഫോർമൽ ലുക്ക്.", "Brown with black — a dark formal look."),
  ],
  KHAKI_BEIGE: [
    p("DARK_NEUTRAL", "office", "കാക്കി ഷർട്ടിന് ബ്ലാക്ക് — വൃത്തിയുള്ള കോംബോ.", "Khaki with black — a clean pair."),
    p("NAVY", "office", "കാക്കിക്ക് നേവി — ഓഫീസിനും പുറത്തും.", "Khaki with navy — office and outings."),
    p("BROWN", "casual", "കാക്കിക്ക് ബ്രൗൺ — സാധാരണ, നാടൻ ലുക്ക്.", "Khaki with brown — easy and warm."),
  ],
  DARK_NEUTRAL: [
    p("DARK_NEUTRAL", "wedding", "ഫുൾ ബ്ലാക്ക് — കല്യാണത്തിനും പാർട്ടിക്കും.", "All black — for weddings and parties."),
    p("GREY", "office", "ബ്ലാക്ക് ഷർട്ടിന് ഗ്രേ — ഒതുങ്ങിയ ലുക്ക്.", "Black with grey — a neat look."),
    p("KHAKI_BEIGE", "casual", "ബ്ലാക്ക് ഷർട്ടിന് കാക്കി — സാധാരണ ഉപയോഗത്തിന്.", "Black with khaki — for everyday wear."),
  ],
  BRIGHT: [
    p("DARK_NEUTRAL", "wedding", "തിളങ്ങുന്ന നിറത്തിന് ബ്ലാക്ക് — ഷർട്ട് തെളിഞ്ഞുനിൽക്കും.", "Bright with black — the shirt stands out."),
    p("GREY", "casual", "തിളങ്ങുന്ന നിറത്തിന് ഗ്രേ — നിറം ഒതുങ്ങും.", "Bright with grey — tones it down."),
  ],
};

/* ───────────────────────── Step 3: recommend ───────────────────────── */

export type ComboFabric = {
  id: number;
  hex: string | null;
  bucketOverride?: string | null;
  suitableFor?: string | null;
  pattern: string | null;
  balanceMtr: number;
  active: boolean;
  /** the words that could say "voile" (brand, type, composition) — a thin shirting voile is never a trouser */
  words?: string;
  /** the fabric's Type (Shirting / Suiting / ...) — pant cloth is Suiting */
  type?: string | null;
  /** for "prefer slow-moving stock": the date it came into stock (older first) */
  since?: string | null;
};

export const isPlain = (pattern: string | null | undefined) => /^plain|^solid/i.test((pattern ?? "").trim());
/** An empty pattern on the shirt counts as plain; on a trouser it is unknown, so a pattern shirt never gets it. */
const shirtIsPatterned = (pattern: string | null | undefined) => !!(pattern ?? "").trim() && !isPlain(pattern);

/**
 * Pant cloth: marked "suiting" in Settings → Combinations, or left on "As per Type" with Type = Suiting. A fabric
 * marked "shirting", or typed Shirting (or anything else), is never offered as a trouser. Same rule as the try-on.
 */
export const isPantCloth = (f: { suitableFor?: string | null; type?: string | null }) => {
  const sf = isSuitable(f.suitableFor) ? f.suitableFor : "both";
  return sf === "suiting" || (sf !== "shirting" && /suiting|trouser/i.test(f.type ?? ""));
};
export const trouserSuitable = (f: Pick<ComboFabric, "suitableFor" | "words" | "type">) => isPantCloth(f) && !/voile/i.test(f.words ?? "");

export type Recommendation<T> = { fabric: T; bucket: Bucket; ml: string; en: string; occasion: Occasion };

export function recommend<T extends ComboFabric>(
  shirt: ComboFabric,
  all: T[],
  opts: { minMtr: number; preferSlow?: boolean; max?: number },
): { shirtBucket: Bucket | null; items: Recommendation<T>[]; short: boolean } {
  const shirtBucket = bucketOf(shirt);
  if (!shirtBucket) return { shirtBucket, items: [], short: true };
  const patterned = shirtIsPatterned(shirt.pattern);
  const max = opts.max ?? 3;
  const blocked = (b: Bucket) =>
    (b === shirtBucket && b !== "DARK_NEUTRAL") ||
    (shirtBucket === "NAVY" && b === "MID_BLUE") ||
    (shirtBucket === "MID_BLUE" && b === "NAVY") ||
    (shirtBucket === "BRIGHT" && b === "BRIGHT");
  const groups: Recommendation<T>[][] = [];
  for (const pair of PAIRS[shirtBucket]) {
    if (blocked(pair.to)) continue;
    const fits = all
      .filter((f) => f.id !== shirt.id && f.active && f.balanceMtr >= opts.minMtr && trouserSuitable(f) && (!patterned || isPlain(f.pattern)) && bucketOf(f) === pair.to)
      .sort((a, b) => {
        if (opts.preferSlow) {
          const d = (a.since || "9999").localeCompare(b.since || "9999");
          if (d) return d;
        }
        return b.balanceMtr - a.balanceMtr || a.id - b.id;
      });
    if (fits.length) groups.push(fits.map((fabric) => ({ fabric, bucket: pair.to, ml: pair.ml, en: pair.en, occasion: pair.occasion })));
  }
  // one per colour first, best colour first (white shirt → black, navy, khaki); then the next of each colour
  const items: Recommendation<T>[] = [];
  for (let round = 0; items.length < max && groups.some((g) => g.length > round); round++) {
    for (const g of groups) if (g[round] && items.length < max) items.push(g[round]);
  }
  return { shirtBucket, items, short: items.length < 2 };
}

/* ───────────────────────── Step 5: the set estimate ───────────────────────── */

/**
 * ഷർട്ട് തുണി + പാൻറ്റ് തുണി + സ്റ്റിച്ചിങ് — read from the existing fabric-requirement table and price list only.
 * Without measurements the shirt figure is the middle chest band for the sleeve. Stitching is left out unless both
 * garments have a price. Null when either fabric has no sale rate.
 */
export function setEstimate(o: {
  shirtRate: number;
  trouserRate: number;
  shirtMtr: number;
  pantMtr: number;
  shirtStitch: number | null;
  pantStitch: number | null;
}) {
  // a fabric without a sale rate gives no honest total
  if (!(o.shirtRate > 0 && o.trouserRate > 0)) return null;
  const fabric = Math.round(o.shirtRate * o.shirtMtr + o.trouserRate * o.pantMtr);
  const stitch = o.shirtStitch != null && o.pantStitch != null ? Math.round(o.shirtStitch + o.pantStitch) : null;
  return { shirtMtr: o.shirtMtr, pantMtr: o.pantMtr, fabric, stitch, total: fabric + (stitch ?? 0) };
}
