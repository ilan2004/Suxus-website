/**
 * Garment variant (തരം) on an order item: Full sleeve / Half sleeve for a shirt, Regular / Loose model for a pant.
 * Chosen on the order — never worked out from the measurements. Required for shirts and pants, optional for the rest.
 *
 * Settings → Variants holds the lists (editable). An item without a list of its own uses the Shirt list when it is a
 * shirt ("School Shirt", "Uniform Shirt" …) and the Pant list when it is a pant ("School Pant" …).
 */
export type VariantLists = Record<string, string[]>;

export const DEFAULT_VARIANTS: VariantLists = {
  Shirt: ["Full sleeve", "Half sleeve"],
  Pant: ["Regular", "Loose model"],
};

/** Which garment table an item belongs to ("Shirt", "School Shirt" → shirt; "Pant", "School Pant" → pant). */
export function kindOf(item: string): "shirt" | "pant" | null {
  const i = item.toLowerCase();
  // an alteration ("Alteration - Shirt Fitting") is not a garment to cut: no variant, no fabric estimate
  if (/alteration/.test(i)) return null;
  if (/shirt/.test(i) && !/t-shirt|tshirt/.test(i) && !/pant/.test(i)) return "shirt";
  if (/pant|trouser/.test(i) && !/shirt/.test(i)) return "pant";
  return null;
}

/** The variants an item can have (empty = no variants for it). */
export function variantsFor(item: string, lists: VariantLists): string[] {
  const own = lists[item];
  if (own?.length) return own;
  const k = kindOf(item);
  if (k === "shirt") return lists.Shirt?.length ? lists.Shirt : DEFAULT_VARIANTS.Shirt;
  if (k === "pant") return lists.Pant?.length ? lists.Pant : DEFAULT_VARIANTS.Pant;
  return [];
}

/** Shirts and pants must have a variant; other garments may. */
export const variantRequired = (item: string) => kindOf(item) != null;

export function sleeveOfVariant(v: string | null | undefined): "full" | "half" | null {
  if (!v) return null;
  if (/half/i.test(v)) return "half";
  if (/full/i.test(v)) return "full";
  return null;
}
export function pantModelOfVariant(v: string | null | undefined): "Regular" | "Loose" | null {
  if (!v) return null;
  return /loose/i.test(v) ? "Loose" : "Regular";
}

const ML: Record<string, string> = {
  "full sleeve": "ഫുൾ കൈ",
  "half sleeve": "ഹാഫ് കൈ",
  regular: "സാധാരണ",
  "loose model": "ലൂസ് മോഡൽ",
};
/** Malayalam for the standard variants (others as typed). */
export const variantMl = (v: string) => ML[v.toLowerCase()] ?? v;
