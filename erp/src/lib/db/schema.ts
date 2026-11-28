import { sql } from "drizzle-orm";

/*
 * App schema. staff, fabrics, order_items and measurements are defined here WITHOUT the columns the newer features
 * added (simple_mode, opening_mtr / opening_cost_per_mtr, wearer_id). Whole-row reads and inserts list every
 * column a table defines, so a column missing from the database would break signing in, saving an order, etc.
 * Those columns are read and written only through the guarded definitions in ./ext.ts. The complete tables, which
 * the migration tool (drizzle-kit) compares against, are in ./schema-kit.ts.
 */
import {
  customType,
  type AnyPgColumn,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

/** Money / metres: numeric in Postgres, number in TypeScript. */
const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });
const created = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updated = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date());

/* ───────────────────────── System ───────────────────────── */

/** Key/value settings: shop info, dropdown lists, piece rates, incentive slabs, size chart. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updated(),
});

/** Gap-free document numbering: FS-0001, SO-0001, BO-0001, fabric codes per prefix … */
export const counters = pgTable("counters", {
  key: text("key").primaryKey(),
  value: integer("value").notNull().default(0),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    at: created(),
    staffId: integer("staff_id"),
    staffName: text("staff_name"),
    action: text("action").notNull(), // create | update | delete | login
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    summary: text("summary"),
  },
  (t) => [index("audit_at_idx").on(t.at)],
);

/* ───────────────────────── People ───────────────────────── */

export const staffColumns = () => ({
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(), // S01
  name: text("name").notNull(),
  role: text("role"), // Partner, Tailor …
  phone: text("phone"),
  joinDate: date("join_date"),
  payType: text("pay_type"),
  monthlySalary: money("monthly_salary"),
  pieceRate: money("piece_rate"),
  incentive: boolean("incentive").notNull().default(false),
  ownIncentivePct: numeric("own_incentive_pct", { precision: 6, scale: 4, mode: "number" }),
  status: text("status").notNull().default("Active"),
  remarks: text("remarks"),
  /** App login. none = cannot log in. */
  access: text("access").notNull().default("none"), // owner | partner | staff | none
  pinHash: text("pin_hash"),
  /** Short name shown at the top and on records ("by GK"). */
  displayName: text("display_name"),
  /** Wrong PINs in a row; at 5 the login locks until lockedUntil. */
  failedPins: integer("failed_pins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  /** Bumped on PIN reset / role change / sign-in removed: signs that user out on every device. */
  sessionVersion: integer("session_version").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});
export const staff = pgTable("staff", staffColumns());

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // C-0001
    name: text("name").notNull(),
    /** Full international number, e.g. +919847123456 / +971501234567 */
    phone: text("phone"),
    /** Second number (e.g. Gulf WhatsApp) — either can be used for WhatsApp. */
    altPhone: text("alt_phone"),
    place: text("place"),
    type: text("type"), // Walk-in, Regular, Institution …
    firstVisit: date("first_visit"),
    remarks: text("remarks"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("customers_phone_idx").on(t.phone), index("customers_name_idx").on(t.name)],
);

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type"),
  place: text("place"),
  phone: text("phone"),
  upi: text("upi"),
  bank: text("bank"),
  gstNo: text("gst_no"),
  supplies: text("supplies"),
  /** Other names this supplier appears under — GPay name, nickname, shop sign (comma separated). */
  aliases: text("aliases"),
  /** Money already owed before the book was started — added to the balance due. */
  openingBalance: money("opening_balance").notNull().default(0),
  notes: text("notes"),
  createdAt: created(),
  updatedAt: updated(),
});

/* ───────────────────────── Fabric ───────────────────────── */

export const fabricsColumns = () => ({
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // LIN-001
    barcode: text("barcode"),
    brand: text("brand").notNull(), // Brand / Quality
    type: text("type"),
    shade: text("shade"),
    composition: text("composition"),
    colourFamily: text("colour_family"),
    supplierId: integer("supplier_id").references(() => suppliers.id),
    purchaseDate: date("purchase_date"),
    purchaseMtr: money("purchase_mtr").notNull().default(0),
    costPerMtr: money("cost_per_mtr").notNull().default(0),
    saleRate: money("sale_rate").notNull().default(0),
    remarks: text("remarks"),
    active: boolean("active").notNull().default(true),
    /** Opening stock: the partner who brought this fabric into the business. Empty = bought by the business. */
    broughtInBy: text("brought_in_by"),
    /** Photo URLs in display order — the first is the main photo (max 4). */
    photoUrls: jsonb("photo_urls").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    /** 300 px square thumbnails, same order as photoUrls. */
    thumbUrls: jsonb("thumb_urls").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    /** Thumbnail of the main photo, for list views. */
    thumbnailUrl: text("thumbnail_url"),
    /** Originals WITH the scale card (measurement only — never shown). Same order as photoUrls; null = no card. */
    photoOriginalUrls: jsonb("photo_original_urls").$type<(string | null)[]>().notNull().default(sql`'[]'::jsonb`),
    /** Plain / Solid · Check · Stripe · Print · Dobby / Self design · Other (empty on older records). */
    pattern: text("pattern"),
    /** Check / stripe repeat in mm — measured from the scale card, or typed. */
    patternMm: numeric("pattern_mm", { precision: 6, scale: 1, mode: "number" }),
    /** "card" = measured from the scale card · "hand" = typed (never overwritten automatically). */
    patternMmSource: text("pattern_mm_source"),
    /** Sampled from the main photo (cloth area, away from the card). */
    dominantHex: text("dominant_hex"),
    secondaryHexes: jsonb("secondary_hexes").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    /** Per swatch [dominant, secondary 1, secondary 2]: "auto" or "hand" (hand = never overwritten). */
    colourSources: jsonb("colour_sources").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: created(),
    updatedAt: updated(),
});
export const fabricsIndexes = (t: { barcode: AnyPgColumn }) => [index("fabrics_barcode_idx").on(t.barcode)];
export const fabrics = pgTable("fabrics", fabricsColumns(), fabricsIndexes);

/* ───────────────────────── Fabric sales (bills) ───────────────────────── */

export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    billNo: text("bill_no").notNull().unique(), // FS-0001
    date: date("date").notNull(),
    customerId: integer("customer_id").references(() => customers.id),
    customerName: text("customer_name"),
    phone: text("phone"),
    subtotal: money("subtotal").notNull().default(0),
    discount: money("discount").notNull().default(0),
    net: money("net").notNull().default(0),
    paymentMode: text("payment_mode").notNull().default("Cash"),
    stitchingHere: boolean("stitching_here").notNull().default(false),
    orderId: integer("order_id"),
    soldById: integer("sold_by_id").references(() => staff.id),
    remarks: text("remarks"),
    cancelled: boolean("cancelled").notNull().default(false),
    /** Who entered it (display name). */
    createdBy: text("created_by"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("sales_date_idx").on(t.date)],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    fabricId: integer("fabric_id").references(() => fabrics.id),
    description: text("description").notNull(),
    metres: money("metres").notNull(),
    rate: money("rate").notNull(),
    amount: money("amount").notNull(),
  },
  (t) => [index("sale_items_sale_idx").on(t.saleId), index("sale_items_fabric_idx").on(t.fabricId)],
);

/* ───────────────────────── Stitching / alteration orders ───────────────────────── */

export const orders = pgTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    orderNo: text("order_no").notNull().unique(), // SO-0001
    date: date("date").notNull(),
    customerId: integer("customer_id").references(() => customers.id),
    customerName: text("customer_name"),
    phone: text("phone"),
    workType: text("work_type").notNull(),
    urgency: text("urgency").notNull().default("Normal"),
    trialDate: date("trial_date"),
    deliveryDate: date("delivery_date"),
    status: text("status").notNull().default("Booked"),
    tailorId: integer("tailor_id").references(() => staff.id),
    broughtById: integer("brought_by_id").references(() => staff.id),
    /** Linked fabric bill when the customer bought shop fabric for this order. */
    saleId: integer("sale_id").references(() => sales.id),
    fabricAmount: money("fabric_amount").notNull().default(0),
    stitchingAmount: money("stitching_amount").notNull().default(0),
    discount: money("discount").notNull().default(0),
    total: money("total").notNull().default(0),
    remarks: text("remarks"),
    photoUrl: text("photo_url"),
    deliveredOn: date("delivered_on"),
    /** Who booked it / last changed it (display names). */
    createdBy: text("created_by"),
    updatedBy: text("updated_by"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("orders_date_idx").on(t.date), index("orders_status_idx").on(t.status)],
);

export const orderItemsColumns = () => ({
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  item: text("item").notNull(),
  qty: integer("qty").notNull().default(1),
  rate: money("rate").notNull().default(0),
  amount: money("amount").notNull().default(0),
  /** Who stitches this item (piece-rate wages follow the item). Null = not given out yet. */
  tailorId: integer("tailor_id").references(() => staff.id),
});
export const orderItems = pgTable("order_items", orderItemsColumns());

/**
 * Which fabric each order item is cut from (optional) — for the fabric requirement estimate, the short-stock warning
 * and the per-fabric totals. Its own table, so the order tables are untouched. Stock is NOT reduced by this: only bills
 * reduce stock.
 */
export const orderItemFabrics = pgTable("order_item_fabrics", {
  orderItemId: integer("order_item_id")
    .primaryKey()
    .references(() => orderItems.id, { onDelete: "cascade" }),
  fabricId: integer("fabric_id")
    .notNull()
    .references(() => fabrics.id, { onDelete: "cascade" }),
});

/**
 * Job slip PDF links: one long random token per order item (its own page) or per order (all pages). Opening
 * /j/<token> returns that job slip PDF only — no login, nothing else reachable from it.
 */
export const jobSlipLinks = pgTable(
  "job_slip_links",
  {
    id: serial("id").primaryKey(),
    /** item | order */
    kind: text("kind").notNull(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderItemId: integer("order_item_id").references(() => orderItems.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex("job_slip_links_token_idx").on(t.token), uniqueIndex("job_slip_links_ref_idx").on(t.kind, t.orderId, t.orderItemId)],
);

/** Every bundle label printed and every job slip PDF viewed or shared — with when and who. */
export const jobSlipEvents = pgTable(
  "job_slip_events",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    orderItemId: integer("order_item_id").references(() => orderItems.id, { onDelete: "set null" }),
    /** label | view | share */
    action: text("action").notNull(),
    /** app = signed-in user · link = opened from a shared link without signing in */
    via: text("via").notNull().default("app"),
    staffName: text("staff_name"),
    /** What was printed / opened, e.g. "Shirt — Anas" (kept if the item is later removed) */
    detail: text("detail"),
    at: created(),
  },
  (t) => [index("job_slip_events_order_idx").on(t.orderId)],
);

/* ───────────────────────── Bulk / institution orders ───────────────────────── */

export const bulkOrders = pgTable("bulk_orders", {
  id: serial("id").primaryKey(),
  orderNo: text("order_no").notNull().unique(), // BO-0001
  date: date("date").notNull(),
  institution: text("institution").notNull(),
  address: text("address"),
  contactPerson: text("contact_person"),
  phone: text("phone"),
  gstin: text("gstin"),
  fabricBy: text("fabric_by"), // Shop / Institution
  deliveryDate: date("delivery_date"),
  status: text("status").notNull().default("Booked"),
  broughtById: integer("brought_by_id").references(() => staff.id),
  subtotal: money("subtotal").notNull().default(0),
  discount: money("discount").notNull().default(0),
  gstPct: money("gst_pct").notNull().default(0),
  gstAmount: money("gst_amount").notNull().default(0),
  total: money("total").notNull().default(0),
  remarks: text("remarks"),
  /** Who entered it (display name). */
  createdBy: text("created_by"),
  createdAt: created(),
  updatedAt: updated(),
});

export const bulkOrderItemsColumns = () => ({
  id: serial("id").primaryKey(),
  bulkOrderId: integer("bulk_order_id")
    .notNull()
    .references(() => bulkOrders.id, { onDelete: "cascade" }),
  item: text("item").notNull(),
  description: text("description"),
  size: text("size"),
  qty: integer("qty").notNull().default(1),
  rate: money("rate").notNull().default(0),
  amount: money("amount").notNull().default(0),
});
export const bulkOrderItems = pgTable("bulk_order_items", bulkOrderItemsColumns());

/**
 * Settings → Stitching Prices: what the shop CHARGES for stitching, per garment and variant (the tailor's piece rate —
 * what we PAY — stays in Tailor Wages). Filled onto an order item when the garment is added and then stored there:
 * changing a price never alters an existing order or bill.
 */
export const stitchingPrices = pgTable(
  "stitching_prices",
  {
    id: serial("id").primaryKey(),
    garment: text("garment").notNull(),
    /** "" = the garment has no variants */
    variant: text("variant").notNull().default(""),
    /** Customer rate — null = not set (never treated as 0) */
    customerRate: money("customer_rate"),
    /** Bulk / institution rate (optional) — Bulk Orders and Institution Bills */
    bulkRate: money("bulk_rate"),
    active: boolean("active").notNull().default(true),
    updatedBy: text("updated_by"),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("stitching_prices_garment_variant_idx").on(t.garment, t.variant)],
);

/* ───────────────────────── Payments received (advance + later collections) ───────────────────────── */

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    kind: text("kind").notNull(), // order | bulk
    orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }),
    bulkOrderId: integer("bulk_order_id").references(() => bulkOrders.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    mode: text("mode").notNull().default("Cash"),
    note: text("note"),
    receivedById: integer("received_by_id").references(() => staff.id),
    /** Who entered it (display name). */
    createdBy: text("created_by"),
    createdAt: created(),
  },
  (t) => [index("payments_order_idx").on(t.orderId), index("payments_bulk_idx").on(t.bulkOrderId)],
);

/* ───────────────────────── Measurements ───────────────────────── */

/**
 * A person who is measured, belonging to one customer (the account / phone). A parent's account holds
 * the children whose uniforms are stitched. Every customer has one "Self" wearer (isSelf); while that is
 * the only one, screens behave as if wearers did not exist.
 */
export const wearers = pgTable(
  "wearers",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Self, Son, Daughter, Wife, Husband, Father, Mother, Brother, Sister, Other */
    relation: text("relation").notNull().default("Other"),
    /** School / class — useful for uniforms. */
    school: text("school"),
    note: text("note"),
    isSelf: boolean("is_self").notNull().default(false),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("wearers_customer_idx").on(t.customerId), uniqueIndex("wearers_one_self_idx").on(t.customerId).where(sql`${t.isSelf}`)],
);

export const measurementsColumns = () => ({
    id: serial("id").primaryKey(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    garmentType: text("garment_type").notNull(),
    size: text("size"),
    fit: text("fit"),
    values: jsonb("values").$type<Record<string, number | null>>().notNull().default(sql`'{}'::jsonb`),
    remarks: text("remarks"),
    createdAt: created(),
    updatedAt: updated(),
});
export const measurementsIndexes = (t: { customerId: AnyPgColumn }) => [index("measurements_customer_idx").on(t.customerId)];
export const measurements = pgTable("measurements", measurementsColumns(), measurementsIndexes);

/**
 * A half-finished measurement in simple mode, saved after every field so a locked phone, a call or a closed
 * app never loses work. One row per entry in progress; removed when the measurement is saved.
 */
export const measurementDraftsColumns = () => ({
    id: serial("id").primaryKey(),
    staffId: integer("staff_id")
      .notNull()
      .references(() => staff.id, { onDelete: "cascade" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    wearerId: integer("wearer_id").references(() => wearers.id, { onDelete: "cascade" }),
    /** Set when an existing record is being changed (null = a new record). */
    measurementId: integer("measurement_id").references(() => measurements.id, { onDelete: "cascade" }),
    garmentType: text("garment_type").notNull(),
    size: text("size"),
    fit: text("fit"),
    remarks: text("remarks"),
    values: jsonb("values").$type<Record<string, number | null>>().notNull().default(sql`'{}'::jsonb`),
    /** The field being entered (index in the measuring order); = number of fields → the final check. */
    step: integer("step").notNull().default(0),
    updatedAt: updated(),
});
export const measurementDraftsIndexes = (t: { staffId: AnyPgColumn }) => [index("measurement_drafts_staff_idx").on(t.staffId)];
export const measurementDrafts = pgTable("measurement_drafts", measurementDraftsColumns(), measurementDraftsIndexes);

/* ───────────────────────── Money out ───────────────────────── */

export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  invoiceNo: text("invoice_no"),
  description: text("description"),
  qty: money("qty").notNull().default(0),
  rate: money("rate").notNull().default(0),
  taxable: money("taxable").notNull().default(0),
  gstPct: money("gst_pct").notNull().default(0),
  gstAmount: money("gst_amount").notNull().default(0),
  total: money("total").notNull().default(0),
  paid: money("paid").notNull().default(0),
  remarks: text("remarks"),
  /** Import key (Entry ID or Date+Supplier+Total) for re-imports. */
  entryId: text("entry_id"),
  createdAt: created(),
  updatedAt: updated(),
});

export const tailorWages = pgTable("tailor_wages", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  tailorId: integer("tailor_id")
    .notNull()
    .references(() => staff.id),
  orderNo: text("order_no"),
  item: text("item").notNull(),
  qty: integer("qty").notNull().default(1),
  rate: money("rate").notNull().default(0),
  amount: money("amount").notNull().default(0),
  paid: money("paid").notNull().default(0),
  remarks: text("remarks"),
  createdAt: created(),
  updatedAt: updated(),
});

export const incentivePayouts = pgTable("incentive_payouts", {
  id: serial("id").primaryKey(),
  fromDate: date("from_date").notNull(),
  toDate: date("to_date").notNull(),
  staffId: integer("staff_id")
    .notNull()
    .references(() => staff.id),
  business: money("business").notNull().default(0),
  collected: money("collected").notNull().default(0),
  ratePct: numeric("rate_pct", { precision: 6, scale: 4, mode: "number" }).notNull().default(0),
  incentive: money("incentive").notNull().default(0),
  paid: money("paid").notNull().default(0),
  remarks: text("remarks"),
  createdAt: created(),
  updatedAt: updated(),
});

export const setupExpenses = pgTable("setup_expenses", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  paidTo: text("paid_to"),
  supplierId: integer("supplier_id").references(() => suppliers.id),
  paidBy: text("paid_by").notNull(),
  amount: money("amount").notNull(),
  mode: text("mode"),
  billNo: text("bill_no"),
  hasBill: boolean("has_bill").notNull().default(false),
  remarks: text("remarks"),
  /** Import key (Entry ID from the Excel file, or Date+Paid To+Amount) — lets a re-import update instead of duplicating. */
  entryId: text("entry_id"),
  createdAt: created(),
  updatedAt: updated(),
});

export const openingStock = pgTable("opening_stock", {
  id: serial("id").primaryKey(),
  assetType: text("asset_type").notNull(),
  description: text("description").notNull(),
  qty: money("qty").notNull().default(0),
  unitValue: money("unit_value").notNull().default(0),
  ownedBy: text("owned_by").notNull(),
  condition: text("condition"),
  valuationDate: date("valuation_date"),
  remarks: text("remarks"),
  createdAt: created(),
  updatedAt: updated(),
});

export const cashBook = pgTable(
  "cash_book",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    particulars: text("particulars").notNull(),
    category: text("category").notNull(),
    amountIn: money("amount_in").notNull().default(0),
    amountOut: money("amount_out").notNull().default(0),
    mode: text("mode").notNull().default("Cash"),
    partner: text("partner"), // only for Capital Introduced / Owner Withdrawal
    remarks: text("remarks"),
    /** Set when the entry was posted automatically from a sale / payment / wage etc. */
    source: text("source"),
    sourceId: integer("source_id"),
    /** Import key for manual entries brought in from Excel. */
    entryId: text("entry_id"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("cash_book_date_idx").on(t.date), uniqueIndex("cash_book_source_idx").on(t.source, t.sourceId)],
);

/** Payments made to a supplier after the purchase (balance settlement). */
export const supplierPayments = pgTable(
  "supplier_payments",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    supplierId: integer("supplier_id")
      .notNull()
      .references(() => suppliers.id, { onDelete: "cascade" }),
    amount: money("amount").notNull(),
    mode: text("mode").notNull().default("Cash"),
    /** UPI / bank reference */
    ref: text("ref"),
    /** "Business Account" → posted to the cash book. A partner's name → their own money (not in the cash book). Empty → imported, unknown. */
    paidBy: text("paid_by"),
    note: text("note"),
    /** Import key (Entry ID or Date+Supplier+Amount) for re-imports. */
    entryId: text("entry_id"),
    /** Who entered it (display name). */
    createdBy: text("created_by"),
    createdAt: created(),
  },
  (t) => [index("supplier_payments_supplier_idx").on(t.supplierId)],
);

/** Wage payouts to tailors (settles their piece-rate balance). */
export const wagePayments = pgTable(
  "wage_payments",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    tailorId: integer("tailor_id")
      .notNull()
      .references(() => staff.id),
    amount: money("amount").notNull(),
    mode: text("mode").notNull().default("Cash"),
    note: text("note"),
    /** Who entered it (display name). */
    createdBy: text("created_by"),
    createdAt: created(),
  },
  (t) => [index("wage_payments_tailor_idx").on(t.tailorId)],
);

/** Rows deleted in the ERP that came from Excel — a Merge import will not add them back. */
export const importDeleted = pgTable(
  "import_deleted",
  {
    entity: text("entity").notNull(), // setup_expense | purchase | cash_book | supplier_payment
    entryId: text("entry_id").notNull(),
    summary: text("summary"),
    deletedAt: created(),
  },
  (t) => [uniqueIndex("import_deleted_pk").on(t.entity, t.entryId)],
);

/* ───────────────────────── WhatsApp messages ───────────────────────── */

/** Saved WhatsApp message templates (Settings → Message templates). Body may hold {name} {order_no} … placeholders. */
export const messageTemplates = pgTable("message_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Greeting"), // Greeting | Order | Payment | Offer
  body: text("body").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  useCount: integer("use_count").notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
});

/** Every message sent from the ERP (one customer at a time via wa.me) — shown as "Messages sent" on the customer. */
export const customerMessages = pgTable(
  "customer_messages",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
    bulkOrderId: integer("bulk_order_id").references(() => bulkOrders.id, { onDelete: "set null" }),
    templateId: integer("template_id").references(() => messageTemplates.id, { onDelete: "set null" }),
    templateName: text("template_name"),
    phone: text("phone").notNull(),
    text: text("text").notNull(),
    sentBy: text("sent_by"),
    sentAt: created(),
  },
  (t) => [index("customer_messages_customer_idx").on(t.customerId)],
);

/* ───────────────────────── Contact import ───────────────────────── */

/**
 * Phone contacts uploaded on Customers → Import contacts. Kept between sittings so a long list can be
 * worked through over many days. status: pending (not yet reviewed) | added | skipped | invalid (phone unreadable).
 */
export const contactImports = pgTable(
  "contact_imports",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    /** Full international number (+91…, +971…); null when it could not be read. */
    phone: text("phone"),
    /** "Second number" column, when readable. */
    phone2: text("phone2"),
    rawPhone: text("raw_phone"),
    status: text("status").notNull().default("pending"),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
    source: text("source"), // file name
    reviewedBy: text("reviewed_by"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [uniqueIndex("contact_imports_phone_uq").on(t.phone), index("contact_imports_status_idx").on(t.status)],
);

/** Every stage change of a stitching order (board, order page, "mark delivered" on payment). */
export const orderStatusChanges = pgTable(
  "order_status_changes",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: text("from_status"),
    toStatus: text("to_status").notNull(),
    changedBy: text("changed_by"),
    changedAt: created(),
  },
  (t) => [index("order_status_changes_order_idx").on(t.orderId)],
);

/**
 * Fabric stock movements. "receipt" = more of the same cloth arrived (Add stock); "adjust" = a correction
 * (damage, shortage, counting mistake) with a required reason. Both add to the fabric's Bought total
 * (adjust may be negative), so Balance stays Bought − Sold. Kept as separate kinds so purchases and
 * corrections are never mixed up in the history.
 */
export const fabricStockMoves = pgTable(
  "fabric_stock_moves",
  {
    id: serial("id").primaryKey(),
    fabricId: integer("fabric_id")
      .notNull()
      .references(() => fabrics.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // receipt | adjust
    date: date("date").notNull(),
    /** Metres received (receipt, > 0) or the correction (adjust, + or −). */
    metres: money("metres").notNull(),
    /** Receipt: cost per metre of this lot. */
    rate: money("rate"),
    supplierId: integer("supplier_id").references(() => suppliers.id, { onDelete: "set null" }),
    billNo: text("bill_no"),
    /** Receipt: remarks · adjust: the reason (required). */
    remarks: text("remarks"),
    boughtAfter: money("bought_after").notNull(),
    balanceAfter: money("balance_after").notNull(),
    /** Fabric cost / metre before and after this movement (weighted average on receipts). */
    rateBefore: money("rate_before"),
    rateAfter: money("rate_after"),
    createdBy: text("created_by"),
    createdAt: created(),
  },
  (t) => [index("fabric_stock_moves_fabric_idx").on(t.fabricId, t.id)],
);

/** One row per fabric photo analysed (scale card, repeat, colours) — to check how reliable the measurement is. */
export const fabricPhotoLog = pgTable(
  "fabric_photo_log",
  {
    id: serial("id").primaryKey(),
    fabricId: integer("fabric_id").references(() => fabrics.id, { onDelete: "set null" }),
    photoUrl: text("photo_url"),
    originalUrl: text("original_url"),
    imageWidth: integer("image_width"),
    imageHeight: integer("image_height"),
    cardFound: boolean("card_found").notNull(),
    cardLongPx: numeric("card_long_px", { precision: 8, scale: 1, mode: "number" }),
    cardShortPx: numeric("card_short_px", { precision: 8, scale: 1, mode: "number" }),
    mmPerPx: numeric("mm_per_px", { precision: 10, scale: 5, mode: "number" }),
    periodPx: numeric("period_px", { precision: 8, scale: 2, mode: "number" }),
    repeatAxis: text("repeat_axis"),
    repeatCount: numeric("repeat_count", { precision: 8, scale: 1, mode: "number" }),
    repeatStrength: numeric("repeat_strength", { precision: 4, scale: 2, mode: "number" }),
    patternMm: numeric("pattern_mm", { precision: 6, scale: 1, mode: "number" }),
    colours: jsonb("colours").$type<{ hex: string; share: number }[]>().notNull().default(sql`'[]'::jsonb`),
    createdBy: text("created_by"),
    createdAt: created(),
  },
  (t) => [index("fabric_photo_log_fabric_idx").on(t.fabricId)],
);

/* ───────────────────────── AI fabric try-on (public /tryon) ───────────────────────── */

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

/**
 * A customer's photo or a generated try-on image. Private: served only to the device that made it (its id is a long
 * random token AND the device cookie must match). Deleted after 7 days.
 */
export const tryonImages = pgTable(
  "tryon_images",
  {
    id: text("id").primaryKey(),
    /** HMAC of the device cookie — never the cookie itself */
    device: text("device").notNull(),
    /** photo | result */
    kind: text("kind").notNull(),
    mime: text("mime").notNull(),
    data: bytea("data").notNull(),
    createdAt: created(),
  },
  (t) => [index("tryon_images_created_idx").on(t.createdAt)],
);

/** Every try-on generation (success or failure) — for the daily limit and the cost. */
export const tryonGenerations = pgTable(
  "tryon_generations",
  {
    id: serial("id").primaryKey(),
    createdAt: created(),
    device: text("device").notNull(),
    /** HMAC of the IP address (a shared limit, so clearing cookies does not reset it) */
    ip: text("ip"),
    fabricId: integer("fabric_id").references(() => fabrics.id, { onDelete: "set null" }),
    garment: text("garment").notNull(),
    variant: text("variant"),
    ok: boolean("ok").notNull(),
    /** short reason code on failure (never shown raw to the customer) */
    error: text("error"),
    model: text("model").notNull(),
    costUsd: numeric("cost_usd", { precision: 10, scale: 4, mode: "number" }).notNull().default(0),
    ms: integer("ms"),
    photoId: text("photo_id"),
    resultId: text("result_id"),
    /** the customer pressed "Show on the shop TV" (default off — never shown otherwise); cleared by "remove from TV" */
    onDisplay: boolean("on_display").notNull().default(false),
    displayAt: timestamp("display_at", { withTimezone: true }),
    /** styling choices (null = chosen before styles existed): half | full | full_rolled · tucked | untucked · none | single | double */
    sleeve: text("sleeve"),
    tuck: text("tuck"),
    pocket: text("pocket"),
    /** shirt + pant in one image: the pant cloth and Regular / Loose model (null = shirt only) */
    pantFabricId: integer("pant_fabric_id").references(() => fabrics.id, { onDelete: "set null" }),
    pantVariant: text("pant_variant"),
  },
  (t) => [index("tryon_generations_device_idx").on(t.device, t.createdAt), index("tryon_generations_created_idx").on(t.createdAt)],
);

/** "I want this" on a try-on result: the customer's name and phone, the fabric, variant and the generated image. */
export const tryonEnquiries = pgTable(
  "tryon_enquiries",
  {
    id: serial("id").primaryKey(),
    createdAt: created(),
    name: text("name").notNull(),
    phone: text("phone").notNull(),
    fabricId: integer("fabric_id").references(() => fabrics.id, { onDelete: "set null" }),
    variant: text("variant"),
    /** the generated image (tryon_images.id) — the image itself is deleted after 7 days like every try-on photo */
    resultId: text("result_id"),
    generationId: integer("generation_id"),
    device: text("device").notNull(),
    contacted: boolean("contacted").notNull().default(false),
    contactedBy: text("contacted_by"),
    contactedAt: timestamp("contacted_at", { withTimezone: true }),
  },
  (t) => [index("tryon_enquiries_created_idx").on(t.createdAt)],
);
