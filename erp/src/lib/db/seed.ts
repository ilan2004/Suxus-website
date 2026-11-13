import type { DB } from "./index";
import { settings } from "./schema";
import {
  DEFAULT_COMPOSITIONS,
  DEFAULT_LISTS,
  DEFAULT_PIECE_RATES,
  DEFAULT_SHOP,
  DEFAULT_SIZE_CHART,
  DEFAULT_SLABS,
} from "../defaults";

/** Inserts default settings that do not exist yet. Safe to run on every start. */
export async function seedDefaults(db: DB) {
  const rows = [
    { key: "lists", value: DEFAULT_LISTS },
    { key: "shop", value: DEFAULT_SHOP },
    { key: "compositions", value: DEFAULT_COMPOSITIONS },
    { key: "pieceRates", value: DEFAULT_PIECE_RATES },
    { key: "slabs", value: DEFAULT_SLABS },
    { key: "sizeChart", value: DEFAULT_SIZE_CHART },
  ];
  await db.insert(settings).values(rows).onConflictDoNothing({ target: settings.key });
}
