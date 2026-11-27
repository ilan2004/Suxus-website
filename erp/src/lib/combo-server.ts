import "server-only";
import { getDb, schema } from "./db";
import { features } from "./db/features";
import { col } from "./db/ext";
import { fabricsWithStock } from "./queries";
import { getSetting } from "./settings";
import { DEFAULT_WIDTH, type FabricRequirementTables } from "./fabric-requirement";
import { listPriceFor, type PriceRow } from "./stitching-prices";
import { DEFAULT_VARIANTS } from "./variants";
import { BUCKET_LABEL, OCCASION_LABEL, autoBucket, bucketOf, recommend, setEstimate, type Bucket } from "./combo";

/**
 * Trouser suggestions for a shirt fabric, read from our own stock. No AI call and no cost: colour rules on stored
 * data only, so it answers instantly and keeps working with the try-on key switched off. Nothing here is logged as a
 * try-on.
 */

/** Every fabric with its stock, colour and the owner's corrections (suitable for / colour bucket). */
export async function comboFabrics() {
  const [rows, feat] = await Promise.all([fabricsWithStock(), features()]);
  const extra = new Map<number, { suitableFor: string | null; colourBucket: string | null }>();
  if (feat.combo) {
    const db = await getDb();
    const ext = await db.select({ id: schema.fabrics.id, suitableFor: col.fabricSuitableFor, colourBucket: col.fabricColourBucket }).from(schema.fabrics);
    for (const e of ext) extra.set(e.id, { suitableFor: e.suitableFor, colourBucket: e.colourBucket });
  }
  return rows.map((f) => {
    const e = extra.get(f.id);
    return {
      ...f,
      hex: f.dominantHex,
      suitableFor: e?.suitableFor ?? "both",
      bucketOverride: e?.colourBucket ?? null,
      words: [f.brand, f.type, f.composition, f.shade].filter(Boolean).join(" "),
      since: f.purchaseDate,
    };
  });
}
export type ComboFabricRow = Awaited<ReturnType<typeof comboFabrics>>[number];

/** Metres a Regular pant needs (Settings → Fabric requirement; 1.30 m as given by the shop). */
export function pantMetres(t: FabricRequirementTables) {
  const rows = t.pant.filter((r) => r.model === "Regular");
  return (rows.find((r) => r.width === DEFAULT_WIDTH) ?? rows[0])?.metres ?? 1.3;
}
/** Without measurements: the middle chest band for the sleeve (1.60 m full / 1.40 m half by default). */
export function shirtMetres(t: FabricRequirementTables, sleeve: "full" | "half") {
  const rows = t.shirtChest.filter((r) => r.width === DEFAULT_WIDTH);
  const use = (rows.length ? rows : t.shirtChest).slice().sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity));
  return use.length ? use[Math.floor((use.length - 1) / 2)][sleeve] : sleeve === "full" ? 1.6 : 1.4;
}

async function prices(): Promise<PriceRow[]> {
  if (!(await features()).prices) return [];
  const db = await getDb();
  return db
    .select({ garment: schema.stitchingPrices.garment, variant: schema.stitchingPrices.variant, customerRate: schema.stitchingPrices.customerRate, bulkRate: schema.stitchingPrices.bulkRate, active: schema.stitchingPrices.active })
    .from(schema.stitchingPrices);
}

export type ComboCard = {
  id: number;
  code: string;
  name: string;
  colour: string | null;
  hex: string | null;
  rate: number;
  thumb: string | null;
  photo: string | null;
  bucket: Bucket;
  bucketMl: string;
  reason: { ml: string; en: string };
  occasion: { ml: string; en: string };
  estimate: ReturnType<typeof setEstimate>;
};

/** Public fields only (no cost, no supplier, no stock figures) — the try-on page shows these to customers. */
export async function combosFor(fabricId: number, sleeve: "full" | "half" = "full") {
  const [all, combo, req] = await Promise.all([comboFabrics(), getSetting("combo"), getSetting("fabricRequirement")]);
  const shirt = all.find((f) => f.id === fabricId);
  if (!shirt) return null;
  const minMtr = pantMetres(req);
  const r = recommend(shirt, all, { minMtr, preferSlow: combo.preferSlow });
  const list = r.items.length ? await prices() : [];
  const shirtStitch = listPriceFor(list, "Shirt", sleeve === "half" ? DEFAULT_VARIANTS.Shirt[1] : DEFAULT_VARIANTS.Shirt[0]);
  const pantStitch = listPriceFor(list, "Pant", DEFAULT_VARIANTS.Pant[0]);
  const shirtMtr = shirtMetres(req, sleeve);
  const items: ComboCard[] = r.items.map(({ fabric: f, bucket, ml, en, occasion }) => ({
    id: f.id,
    code: f.code,
    name: [f.brand, f.shade].filter(Boolean).join(" · "),
    colour: f.shade || f.colourFamily || null,
    hex: f.dominantHex,
    rate: f.saleRate,
    thumb: f.thumbUrls[0] || f.photoUrls[0] || null,
    photo: f.photoUrls[0] || null,
    bucket,
    bucketMl: BUCKET_LABEL[bucket].ml,
    reason: { ml, en },
    occasion: OCCASION_LABEL[occasion],
    estimate: setEstimate({ shirtRate: shirt.saleRate, trouserRate: f.saleRate, shirtMtr, pantMtr: minMtr, shirtStitch, pantStitch }),
  }));
  return { shirtBucket: r.shirtBucket, items, short: r.short };
}

/** Settings → Combinations: every active fabric with its automatic bucket next to the owner's choice. */
export async function comboSettingsRows() {
  const all = await comboFabrics();
  return all
    .filter((f) => f.active)
    .map((f) => ({
      id: f.id,
      code: f.code,
      name: [f.brand, f.shade].filter(Boolean).join(" · "),
      type: f.type,
      pattern: f.pattern,
      hex: f.dominantHex,
      thumb: f.thumbUrls[0] || f.photoUrls[0] || null,
      balanceMtr: f.balanceMtr,
      auto: autoBucket(f.dominantHex),
      override: f.bucketOverride,
      bucket: bucketOf(f),
      suitableFor: f.suitableFor,
    }));
}
