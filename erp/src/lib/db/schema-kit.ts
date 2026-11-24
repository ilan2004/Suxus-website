/**
 * The COMPLETE schema, for the migration tool only (drizzle.config.ts points here). It is the app schema plus the
 * columns the app reaches only through ./ext.ts. The app itself never imports this file.
 * Local declarations below take precedence over the `export *` names, so drizzle-kit sees the full tables.
 */
import { boolean, integer, numeric, pgTable } from "drizzle-orm/pg-core";
import { fabricsColumns, fabricsIndexes, measurementsColumns, measurementsIndexes, orderItemsColumns, staffColumns, wearers } from "./schema";

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
  },
  fabricsIndexes,
);

export const orderItems = pgTable("order_items", {
  ...orderItemsColumns(),
  /** Whose garment — migration 0020 */
  wearerId: integer("wearer_id").references(() => wearers.id, { onDelete: "set null" }),
});

export const measurements = pgTable(
  "measurements",
  {
    ...measurementsColumns(),
    /** Whose measurements — migration 0020 */
    wearerId: integer("wearer_id").references(() => wearers.id, { onDelete: "set null" }),
  },
  measurementsIndexes,
);
