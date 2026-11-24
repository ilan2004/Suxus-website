import "server-only";
import { eq, inArray } from "drizzle-orm";
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
};

const DEFAULTS: AppSettings = {
  lists: DEFAULT_LISTS,
  shop: DEFAULT_SHOP,
  compositions: DEFAULT_COMPOSITIONS,
  pieceRates: DEFAULT_PIECE_RATES,
  slabs: DEFAULT_SLABS,
  sizeChart: DEFAULT_SIZE_CHART,
  measureOrder: {},
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
    if (k === "lists" || k === "shop") {
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
  if (key === "lists" || key === "shop") return { ...DEFAULTS[key], ...(row.value as object) } as AppSettings[K];
  return row.value as AppSettings[K];
}
