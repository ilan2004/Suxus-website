import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { features } from "@/lib/db/features";
import { loadPrices } from "@/lib/actions/prices";
import { variantsFor } from "@/lib/variants";
import { PageHeader } from "@/components/app/page-header";
import { PricesView, type PriceLine } from "./prices-view";

export const metadata = { title: "Stitching Prices" };

/**
 * Settings → Stitching Prices (തുന്നൽക്കൂലി നിരക്ക്): what we CHARGE per garment and variant, beside the tailor's
 * piece rate (what we PAY — read from Tailor Wages, not copied) and the margin. Partners only.
 */
export default async function StitchingPricesPage() {
  await requireUser({ can: "prices" });
  const [settings, prices, feat] = await Promise.all([getSettings(), loadPrices(), features()]);
  // One row per garment and variant in the lists, plus any priced row no longer in them
  const lines: PriceLine[] = [];
  const seen = new Set<string>();
  for (const garment of settings.lists.item) {
    const vs = variantsFor(garment, settings.variants);
    for (const variant of vs.length ? vs : [""]) {
      seen.add(`${garment}|${variant}`);
      const p = prices.find((x) => x.garment === garment && x.variant === variant);
      lines.push({ garment, variant, customerRate: p?.customerRate ?? null, bulkRate: p?.bulkRate ?? null, active: p?.active ?? true, tailorRate: settings.pieceRates[garment] ?? null, listed: true });
    }
  }
  for (const p of prices)
    if (!seen.has(`${p.garment}|${p.variant}`)) lines.push({ ...p, tailorRate: settings.pieceRates[p.garment] ?? null, listed: false });
  return (
    <>
      <PageHeader
        title="Stitching Prices"
        ml="തുന്നൽക്കൂലി നിരക്ക്"
        description="What we charge the customer for stitching, per garment and variant. Filled onto an order when the garment is added, and then kept on that order — changing a price here never changes an existing order or bill."
      />
      {feat.prices ? <PricesView lines={lines} /> : <p className="rounded-xl border bg-card p-5 text-sm text-muted-foreground">Available after the next database update.</p>}
    </>
  );
}
