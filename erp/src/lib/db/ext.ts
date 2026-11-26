import "server-only";
import { boolean, integer, jsonb, numeric, pgTable, text } from "drizzle-orm/pg-core";
import type { Pocket } from "../pocket";
import { sql } from "drizzle-orm";

/*
 * Columns the newer features added to existing tables. They are NOT on the app's table definitions (see the note at
 * the top of ./schema.ts): code reaches them only through these narrow definitions, and only after features() says
 * the database has them. If a migration has not run, that one feature switches off — the rest of the app still opens.
 */
const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });

/** staff.simple_mode — Simple measurement mode */
export const staffExt = pgTable("staff", { id: integer("id").primaryKey(), simpleMode: boolean("simple_mode").notNull() });
/** fabrics.opening_mtr / opening_cost_per_mtr — Add stock */
export const fabricsExt = pgTable("fabrics", { id: integer("id").primaryKey(), openingMtr: money("opening_mtr"), openingCostPerMtr: money("opening_cost_per_mtr") });
/** measurements.wearer_id — Wearers */
export const measurementsExt = pgTable("measurements", { id: integer("id").primaryKey(), wearerId: integer("wearer_id") });
/** order_items.wearer_id — Wearers */
export const orderItemsExt = pgTable("order_items", { id: integer("id").primaryKey(), wearerId: integer("wearer_id") });
/** order_items.variant — Garment variant (തരം) */
export const orderItemsVariant = pgTable("order_items", { id: integer("id").primaryKey(), variant: text("variant") });
/** order_items.list_rate / rate_changed_by — Stitching price list snapshot */
export const orderItemsPrice = pgTable("order_items", { id: integer("id").primaryKey(), listRate: money("list_rate"), rateChangedBy: text("rate_changed_by") });
/** bulk_order_items.variant / list_rate / rate_changed_by — Stitching price list on Bulk Orders */
export const bulkItemsPrice = pgTable("bulk_order_items", { id: integer("id").primaryKey(), variant: text("variant"), listRate: money("list_rate"), rateChangedBy: text("rate_changed_by") });

/** measurements.pocket / measurement_drafts.pocket — Pocket options on a shirt record */
export const measurementsPocket = pgTable("measurements", { id: integer("id").primaryKey(), pocket: jsonb("pocket").$type<Pocket | null>() });
export const draftsPocket = pgTable("measurement_drafts", { id: integer("id").primaryKey(), pocket: jsonb("pocket").$type<Pocket | null>() });

/** For a select list on the un-aliased table: e.g. { wearerId: col.measurementWearer } */
export const col = {
  measurementWearer: sql<number | null>`"measurements"."wearer_id"`.mapWith((v) => (v == null ? null : Number(v))),
  orderItemWearer: sql<number | null>`"order_items"."wearer_id"`.mapWith((v) => (v == null ? null : Number(v))),
  orderItemVariant: sql<string | null>`"order_items"."variant"`,
  orderItemListRate: sql<number | null>`"order_items"."list_rate"`.mapWith((v) => (v == null ? null : Number(v))),
  orderItemRateChangedBy: sql<string | null>`"order_items"."rate_changed_by"`,
  bulkItemVariant: sql<string | null>`"bulk_order_items"."variant"`,
  bulkItemListRate: sql<number | null>`"bulk_order_items"."list_rate"`.mapWith((v) => (v == null ? null : Number(v))),
  bulkItemRateChangedBy: sql<string | null>`"bulk_order_items"."rate_changed_by"`,
  measurementPocket: sql<Pocket | null>`"measurements"."pocket"`.mapWith((v) => (v == null ? null : typeof v === "string" ? (JSON.parse(v) as Pocket) : (v as Pocket))),
  draftPocket: sql<Pocket | null>`"measurement_drafts"."pocket"`.mapWith((v) => (v == null ? null : typeof v === "string" ? (JSON.parse(v) as Pocket) : (v as Pocket))),
  fabricOpeningMtr: sql<number | null>`"fabrics"."opening_mtr"`.mapWith((v) => (v == null ? null : Number(v))),
  fabricOpeningCost: sql<number | null>`"fabrics"."opening_cost_per_mtr"`.mapWith((v) => (v == null ? null : Number(v))),
};

/**
 * A partner's opening cloth, valued at the first entry (so stock the business adds later is not counted as theirs).
 * Before the Add stock migration there is no snapshot: Bought × cost, as it always was.
 */
export const openingClothValue = (stock: boolean) =>
  stock
    ? sql`sum(coalesce("fabrics"."opening_mtr", "fabrics"."purchase_mtr") * coalesce("fabrics"."opening_cost_per_mtr", "fabrics"."cost_per_mtr"))`
    : sql`sum("fabrics"."purchase_mtr" * "fabrics"."cost_per_mtr")`;

/** The column when the feature is on, otherwise a typed null (so one select works before and after the migration). */
export const when = <T>(on: boolean, c: import("drizzle-orm").SQL<T>) => (on ? c : sql<T | null>`null`);
