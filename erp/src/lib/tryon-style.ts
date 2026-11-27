/**
 * Try-on styling choices: sleeve, tuck, pocket — picked BEFORE Generate, so each press is still ONE image and ONE call.
 * Pocket names and order are the measurement record's (pocket.ts POCKET_COUNTS) so the shop and the customer use the
 * same words. Pure — used by the page and the server.
 */
import { POCKET_COUNTS } from "./pocket";

export type Sleeve = "half" | "full" | "full_rolled";
export type Tuck = "tucked" | "untucked";
export type PocketStyle = "none" | "single" | "double";
export type TryonStyle = { sleeve: Sleeve; tuck: Tuck; pocket: PocketStyle };

export const SLEEVES: { v: Sleeve; ml: string; en: string }[] = [
  { v: "half", ml: "ഹാഫ് കൈ", en: "Half sleeve" },
  { v: "full", ml: "ഫുൾ കൈ", en: "Full sleeve" },
  { v: "full_rolled", ml: "ഫുൾ കൈ മടക്കിയത്", en: "Full sleeve, rolled" },
];
export const TUCKS: { v: Tuck; ml: string; en: string }[] = [
  { v: "tucked", ml: "ഇൻസൈഡ്", en: "Tucked in" },
  { v: "untucked", ml: "ഔട്ട്സൈഡ്", en: "Untucked" },
];
/**
 * Same names and order as the measurement record's pocket choice (None / One (left) / Two). Two pockets always means the
 * two-pocket work-shirt style with a buttoned flap on each — there is no plain double pocket.
 */
const POCKET_CODE: Record<string, PocketStyle> = { none: "none", one: "single", two: "double" };
export const POCKETS: { v: PocketStyle; ml: string; en: string }[] = POCKET_COUNTS.map((c) => ({ v: POCKET_CODE[c.v], ml: c.ml, en: c.en }));

export const DEFAULT_STYLE: TryonStyle = { sleeve: "full", tuck: "untucked", pocket: "single" };

/** The order item variant a sleeve belongs to (rolled is a way of wearing a full sleeve). */
export const variantOfSleeve = (s: Sleeve) => (s === "half" ? "Half sleeve" : "Full sleeve");
export const sleeveOfVariantName = (v: string | null | undefined): Sleeve => (/half/i.test(v ?? "") ? "half" : "full");

export const isStyle = (o: { sleeve?: unknown; tuck?: unknown; pocket?: unknown }): o is TryonStyle =>
  SLEEVES.some((x) => x.v === o.sleeve) && TUCKS.some((x) => x.v === o.tuck) && POCKETS.some((x) => x.v === o.pocket);

const label = <T extends string>(list: { v: T; ml: string; en: string }[], v: T) => list.find((x) => x.v === v)!;
/** "ഫുൾ കൈ മടക്കിയത് · ഔട്ട്സൈഡ് · പോക്കറ്റ്: രണ്ട്" (or English). */
export function styleSummary(s: TryonStyle, lang: "ml" | "en" = "ml") {
  const p = label(POCKETS, s.pocket);
  return lang === "ml"
    ? `${label(SLEEVES, s.sleeve).ml} · ${label(TUCKS, s.tuck).ml} · പോക്കറ്റ്: ${p.ml}`
    : `${label(SLEEVES, s.sleeve).en} · ${label(TUCKS, s.tuck).en} · Pocket: ${p.en}`;
}

/** Sentences appended AFTER the existing instruction (never before the colour block). Exact wording as agreed. */
export function styleSentences(s: TryonStyle, pattern: string | null | undefined) {
  const out: string[] = [];
  out.push(
    {
      half: "The shirt has short sleeves ending just above the elbow, with a plain hemmed sleeve opening.",
      full: "The shirt has long sleeves reaching the wrist, with a buttoned cuff visible at the wrist.",
      full_rolled:
        "The shirt has long sleeves that are neatly rolled up: two even folds ending just below the elbow, the folded cuff clearly visible at the top of the fold, the forearm bare. Both sleeves are rolled to the same height. The rolled fabric shows the same fabric colour and pattern as the rest of the shirt.",
    }[s.sleeve],
  );
  out.push(
    {
      untucked: "The shirt is worn untucked, hanging loose over the trousers, hem ending around hip level.",
      tucked:
        "The shirt is tucked into the trousers: a neat, tight tuck with the shirt pulled smooth and flat at the waist and stomach — no puffing, ballooning or loose fabric hanging over the waistband, only a very slight, even blouse. The shirt hem is completely hidden inside the trousers all the way round. The full trouser waistband, its button and the belt loops are clearly visible as a crisp straight line across the waist; a belt, if the person wears one, stays visible. The button placket runs straight down into the waistband, centred. Keep the person's own trousers exactly as they are in the photo — same colour, same fit, do not replace or recolour them. If the person's waist and waistband are not visible in the photograph, render the shirt untucked instead; do not extend the photograph, do not invent a waist, trousers or belt that are not in the original frame.",
    }[s.tuck],
  );
  out.push(
    {
      // the image model copies the pocket from the customer's own shirt unless told plainly to remove it
      none: "IMPORTANT: the new shirt has NO pocket at all — no chest pocket on either side, no patch pocket, no flap, no pocket outline or stitching. The chest is completely plain, smooth fabric from the placket to the side seams. If the person's current shirt in the photo has a pocket, remove it; do not copy it.",
      single: "One plain patch pocket, no flap, on the wearer's left chest, same fabric, pattern aligned with the shirt body.",
      // the owner's wording, as given: two pockets always have a buttoned flap (= the measurement record's two-pocket work-shirt style)
      double:
        "The shirt has two patch pockets, one on each side of the chest, symmetrical in size and position. Each pocket has a buttoned flap: a rectangular flap of the same fabric covering the top of the pocket, fastened with a single visible button at the centre of the flap. Both flaps are the same size and sit at the same height. The pockets and flaps are in the same fabric as the shirt with the pattern aligned to the body of the shirt. This is the two-pocket work-shirt style.",
    }[s.pocket],
  );
  const patterned = !!pattern && !/^plain/i.test(pattern);
  if (patterned && s.pocket !== "none") out.push("Pocket pattern runs the same direction as the shirt body.");
  return out.join("\n");
}
