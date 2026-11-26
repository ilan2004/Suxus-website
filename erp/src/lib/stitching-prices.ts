/**
 * Stitching price list (what the shop charges), matched by garment AND variant. Pure — used on the server and in forms.
 * A garment + variant with no price returns null: the order shows "No stitching rate set" — never a silent 0.
 */
export type PriceRow = { garment: string; variant: string; customerRate: number | null; bulkRate: number | null; active: boolean };

/** The list price for one garment: the bulk / institution rate for bulk work when one is set, else the customer rate. */
export function listPriceFor(prices: PriceRow[], item: string, variant: string | null | undefined, bulk = false): number | null {
  const row = prices.find((p) => p.active && p.garment === item && p.variant === (variant ?? ""));
  if (!row) return null;
  if (bulk && row.bulkRate != null) return row.bulkRate;
  return row.customerRate;
}

/** The charge differs from the list price it was filled from. */
export const rateChanged = (rate: number, listRate: number | null | undefined) => listRate != null && Math.round(rate * 100) !== Math.round(listRate * 100);
