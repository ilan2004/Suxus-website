import "server-only";
import { eq, inArray } from "drizzle-orm";
import { DEFAULT_FABRIC_REQUIREMENT, type FabricRequirementTables } from "./fabric-requirement";
import { DEFAULT_VARIANTS, type VariantLists } from "./variants";
import { getDb, schema } from "./db";
import {
  DEFAULT_COMPOSITIONS,
  DEFAULT_LISTS,
  DEFAULT_PIECE_RATES,
  DEFAULT_SHOP,
  DEFAULT_SIZE_CHART,
  DEFAULT_SLABS,
  type Lists,
  type ShopInfo,
} from "./defaults";

export type AppSettings = {
  lists: Lists;
  shop: ShopInfo;
  compositions: typeof DEFAULT_COMPOSITIONS;
  pieceRates: Record<string, number>;
  slabs: typeof DEFAULT_SLABS;
  sizeChart: typeof DEFAULT_SIZE_CHART;
  /** Simple mode: the order fields are measured in, per garment type (field keys). Empty = stored order. */
  measureOrder: Record<string, string[]>;
  /** Simple mode options. autoAdvance: move to the next field by itself after a pause (OFF — Next only). */
  measureOptions: { autoAdvance: boolean };
  /** Settings → Fabric requirement: metres per garment (shirt chest / length tables, pant), per fabric width */
  fabricRequirement: FabricRequirementTables;
  /** Settings → Variants: the variants (തരം) each garment can have on an order item */
  variants: VariantLists;
  /** Settings → Try-on: master switch, limits (read on every request — no deploy needed) and the TV link token */
  tryon: TryonControls;
  /** Settings → Combinations: trouser suggestions for a shirt fabric (pure colour logic — no AI, no cost) */
  combo: ComboControls;
};
export type ComboControls = {
  /** shown to customers on the try-on page; owner / partner (and staff on the fabric page) always see them */
  enabled: boolean;
  /** among equally good trousers, the ones in stock longest first — never overrides the colour rules */
  preferSlow: boolean;
};
export const DEFAULT_COMBO: ComboControls = { enabled: false, preferSlow: false };
export type TryonControls = {
  enabled: boolean;
  perDevice: 1 | 2;
  shopPerDay: number;
  monthlyCapInr: number;
  displayToken: string;
  /** styling choices (sleeve / tuck / pocket) for customers — off until tested; owner / partner always see them */
  styles: boolean;
  /** website lock: visitors without the shop QR get the web limits below (a WhatsApp code gives more) */
  webLock: boolean;
  /** try-ons per phone from the website, in total (not per day) */
  webPerDevice: 1 | 2;
  /** try-ons from the website per day, all visitors together (separate from shopPerDay) */
  webPerDay: number;
  /** secret in the shop QR (?s=…): scanning it marks the phone as in the shop for 12 hours */
  shopKey: string;
};
export const DEFAULT_TRYON: TryonControls = { enabled: true, perDevice: 2, shopPerDay: 40, monthlyCapInr: 2000, displayToken: "", styles: false, webLock: false, webPerDevice: 1, webPerDay: 10, shopKey: "" };

const DEFAULTS: AppSettings = {
  lists: DEFAULT_LISTS,
  shop: DEFAULT_SHOP,
  compositions: DEFAULT_COMPOSITIONS,
  pieceRates: DEFAULT_PIECE_RATES,
  slabs: DEFAULT_SLABS,
  sizeChart: DEFAULT_SIZE_CHART,
  measureOrder: {},
  measureOptions: { autoAdvance: false },
  fabricRequirement: DEFAULT_FABRIC_REQUIREMENT,
  variants: DEFAULT_VARIANTS,
  tryon: DEFAULT_TRYON,
  combo: DEFAULT_COMBO,
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.settings)
    .where(inArray(schema.settings.key, Object.keys(DEFAULTS)));
  const out = structuredClone(DEFAULTS) as AppSettings;
  for (const r of rows) {
    const k = r.key as keyof AppSettings;
    if (k === "lists" || k === "shop" || k === "tryon" || k === "combo") {
      // merge so that newly added default keys appear for old databases
      (out[k] as object) = { ...DEFAULTS[k], ...(r.value as object) };
    } else {
      (out[k] as unknown) = r.value;
    }
  }
  return out;
}

export async function saveSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
  const db = await getDb();
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

export async function getSetting<K extends keyof AppSettings>(key: K): Promise<AppSettings[K]> {
  const db = await getDb();
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, key));
  if (!row) return DEFAULTS[key];
  if (key === "tryon") return { ...DEFAULT_TRYON, ...(row.value as object) } as AppSettings[K];
  if (key === "combo") return { ...DEFAULT_COMBO, ...(row.value as object) } as AppSettings[K];
  if (key === "lists" || key === "shop") return { ...DEFAULTS[key], ...(row.value as object) } as AppSettings[K];
  return row.value as AppSettings[K];
}
