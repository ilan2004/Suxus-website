/**
 * Pocket (പോക്കറ്റ്) on a SHIRT measurement record — part of how this customer likes their shirt, so it is kept with the
 * measurement and carries over with "Same as last time". Null = not recorded (every record saved before this existed):
 * nothing is guessed, and the job slip simply leaves the pocket section out.
 *
 * The bottom-shape drawings are plain SVG paths (black lines on white) so the same drawing is shown on screen, in simple
 * mode and printed on the job slip PDF.
 */
export type PocketCount = "none" | "one" | "two";
export type PocketSize = "small" | "medium" | "large";
export type PocketShape = "flat" | "pointed" | "cut" | "rounded";
export type Pocket = {
  count: PocketCount;
  size: PocketSize | null;
  /** exact size in inches — when filled in, it overrides Small / Medium / Large */
  width: number | null;
  depth: number | null;
  shape: PocketShape | null;
  flap: boolean;
  /** a button on the flap (only with a flap) */
  button?: boolean;
};

/** A new shirt record starts with: one pocket (left), no flap. */
export const DEFAULT_POCKET: Pocket = { count: "one", size: null, width: null, depth: null, shape: null, flap: false };

export const POCKET_COUNTS: { v: PocketCount; ml: string; en: string }[] = [
  { v: "none", ml: "ഇല്ല", en: "None" },
  { v: "one", ml: "ഒന്ന് (ഇടത്)", en: "One (left)" },
  { v: "two", ml: "രണ്ട്", en: "Two" },
];
export const POCKET_SIZES: { v: PocketSize; ml: string; en: string }[] = [
  { v: "small", ml: "ചെറുത്", en: "Small" },
  { v: "medium", ml: "ഇടത്തരം", en: "Medium" },
  { v: "large", ml: "വലുത്", en: "Large" },
];
export const POCKET_SHAPES: { v: PocketShape; ml: string; en: string }[] = [
  { v: "flat", ml: "പരന്നത്", en: "Flat" },
  { v: "pointed", ml: "കോൺ", en: "Pointed" },
  { v: "cut", ml: "മൂല വെട്ടിയത്", en: "Cut corners" },
  { v: "rounded", ml: "വൃത്താകൃതി", en: "Rounded" },
];

/**
 * Outline of each bottom shape in a 100 × 100 box: the pocket's top edge at y = 12, sides at x = 18 / 82, bottom at
 * y = 88. The hem line just under the top edge is drawn separately (POCKET_HEM).
 */
export const POCKET_PATHS: Record<PocketShape, string> = {
  // plain rectangle
  flat: "M18 12 L82 12 L82 88 L18 88 Z",
  // V point at the bottom centre
  pointed: "M18 12 L82 12 L82 74 L50 92 L18 74 Z",
  // both bottom corners cut at 45°
  cut: "M18 12 L82 12 L82 74 L68 88 L32 88 L18 74 Z",
  // rounded bottom corners
  rounded: "M18 12 L82 12 L82 70 Q82 88 64 88 L36 88 Q18 88 18 70 Z",
};
export const POCKET_HEM = "M18 22 L82 22";

/** The flap over the pocket top: a little wider than the pocket, its lower edge cut like the pocket bottom. */
export const FLAP_PATHS: Record<PocketShape, string> = {
  flat: "M13 9 L87 9 L87 36 L13 36 Z",
  pointed: "M13 9 L87 9 L87 30 L50 41 L13 30 Z",
  cut: "M13 9 L87 9 L87 29 L80 36 L20 36 L13 29 Z",
  rounded: "M13 9 L87 9 L87 27 Q87 36 78 36 L22 36 Q13 36 13 27 Z",
};
/** Button on the flap: centre and radius in the same 100 × 100 box. */
export const FLAP_BUTTON = { cx: 50, cy: 26, r: 4.5 };

/** The common work-shirt style: two pockets, cut corners, flap with a button. */
export const DOUBLE_FLAP_PRESET: Pocket = { count: "two", size: null, width: null, depth: null, shape: "cut", flap: true, button: true };

/** Is this a shirt record (the pocket section applies)? */
export const hasPocket = (garmentType: string) => garmentType === "Shirt";

const labelOf = <T extends string>(list: { v: T; ml: string; en: string }[], v: T | null | undefined) => list.find((x) => x.v === v) ?? null;

/** The pocket in words, for the job slip and cards: Malayalam and English lines. Null when there is nothing to print. */
export function pocketWords(p: Pocket | null | undefined): { ml: string; en: string }[] | null {
  if (!p) return null;
  const count = labelOf(POCKET_COUNTS, p.count)!;
  if (p.count === "none") return [{ ml: `പോക്കറ്റ്: ${count.ml}`, en: "Pocket: none" }];
  const lines = [{ ml: `പോക്കറ്റ്: ${count.ml}`, en: `Pockets: ${count.en}` }];
  const exact = p.width != null || p.depth != null;
  if (exact) lines.push({ ml: `വലുപ്പം: ${num(p.width)} × ${num(p.depth)} ഇഞ്ച്`, en: `Size: ${num(p.width)} wide × ${num(p.depth)} deep (in)` });
  else if (p.size) {
    const s = labelOf(POCKET_SIZES, p.size)!;
    lines.push({ ml: `വലുപ്പം: ${s.ml}`, en: `Size: ${s.en}` });
  }
  const shape = labelOf(POCKET_SHAPES, p.shape);
  if (shape) lines.push({ ml: `അടിഭാഗം: ${shape.ml}`, en: `Bottom: ${shape.en}` });
  lines.push(
    !p.flap
      ? { ml: "ഫ്ലാപ്പ്: ഇല്ല", en: "Without flap" }
      : p.button
        ? { ml: "ഫ്ലാപ്പ്: ബട്ടൺ ഉള്ളത്", en: "Flap with button" }
        : { ml: "ഫ്ലാപ്പ്: ഉണ്ട്", en: "With flap" },
  );
  return lines;
}
const num = (n: number | null) => (n == null ? "?" : String(Math.round(n * 100) / 100));

/** Tidy a pocket from a form: numbers only when positive; size choice dropped when an exact size is given. */
export function cleanPocket(p: Pocket | null | undefined): Pocket | null {
  if (!p) return null;
  const pos = (n: number | null) => (n != null && Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null);
  const width = pos(p.width);
  const depth = pos(p.depth);
  if (p.count === "none") return { count: "none", size: null, width: null, depth: null, shape: null, flap: false, button: false };
  return { count: p.count, size: width != null || depth != null ? null : p.size, width, depth, shape: p.shape, flap: !!p.flap, button: !!p.flap && !!p.button };
}
