/**
 * The COMPLETE schema, for the migration tool only (drizzle.config.ts points here). It is the app schema plus the
 * columns the app reaches only through ./ext.ts. The app itself never imports this file.
 * Local declarations below take precedence over the `export *` names, so drizzle-kit sees the full tables.
 */
import { boolean, integer, jsonb, numeric, pgTable, text } from "drizzle-orm/pg-core";
import { measurementDraftsColumns, measurementDraftsIndexes, bulkOrderItemsColumns, fabricsColumns, fabricsIndexes, measurementsColumns, measurementsIndexes, orderItemsColumns, staffColumns, wearers } from "./schema";

export * from "./schema";

const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });

export const staff = pgTable("staff", {
  ...staffColumns(),
  /** Simple measurement mode (ലളിതമായ അളവ് രീതി) — migration 0021 */
  simpleMode: boolean("simple_mode").notNull().default(false),
});

export const fabrics = pgTable(
  "fabrics",
  {
    ...fabricsColumns(),
    /** First entry snapshot, taken before the first Add / Adjust stock — migration 0019 */
    openingMtr: money("opening_mtr"),
    openingCostPerMtr: money("opening_cost_per_mtr"),
    /** Shirt + trouser combinations: shirting / suiting / both, and a colour-group override (null = automatic) — migration 0031 */
    suitableFor: text("suitable_for").notNull().default("both"),
    colourBucket: text("colour_bucket"),
  },
  fabricsIndexes,
);

export const orderItems = pgTable("order_items", {
  ...orderItemsColumns(),
  /** Whose garment — migration 0020 */
  wearerId: integer("wearer_id").references(() => wearers.id, { onDelete: "set null" }),
  /** Garment variant (തരം): Full sleeve / Half sleeve, Regular / Loose model … Null = not set (older items) — migration 0024 */
  variant: text("variant"),
  /** Stitching price list at the time the charge was filled (null = no list price) — migration 0025 */
  listRate: money("list_rate"),
  /** Who set a charge different from the list price — migration 0025 */
  rateChangedBy: text("rate_changed_by"),
});

export const bulkOrderItems = pgTable("bulk_order_items", {
  ...bulkOrderItemsColumns(),
  /** Variant (തരം) and the price-list snapshot, as on order items — migration 0025 */
  variant: text("variant"),
  listRate: money("list_rate"),
  rateChangedBy: text("rate_changed_by"),
});

export const measurements = pgTable(
  "measurements",
  {
    ...measurementsColumns(),
    /** Whose measurements — migration 0020 */
    wearerId: integer("wearer_id").references(() => wearers.id, { onDelete: "set null" }),
    /** Pocket choices on a shirt record (null = not recorded) — migration 0026 */
    pocket: jsonb("pocket"),
  },
  measurementsIndexes,
);

export const measurementDrafts = pgTable(
  "measurement_drafts",
  {
    ...measurementDraftsColumns(),
    /** Pocket choices of the entry in progress — migration 0026 */
    pocket: jsonb("pocket"),
  },
  measurementDraftsIndexes,
);
