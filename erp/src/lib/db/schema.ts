import { sql } from "drizzle-orm";
import {
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

export const staff = pgTable("staff", {
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
  access: text("access").notNull().default("none"), // partner | staff | none
  pinHash: text("pin_hash"),
  createdAt: created(),
  updatedAt: updated(),
});

export const customers = pgTable(
  "customers",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull().unique(), // C-0001
    name: text("name").notNull(),
    phone: text("phone"),
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
  notes: text("notes"),
  createdAt: created(),
  updatedAt: updated(),
});

/* ───────────────────────── Fabric ───────────────────────── */

export const fabrics = pgTable(
  "fabrics",
  {
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
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("fabrics_barcode_idx").on(t.barcode)],
);

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
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("orders_date_idx").on(t.date), index("orders_status_idx").on(t.status)],
);

export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  item: text("item").notNull(),
  qty: integer("qty").notNull().default(1),
  rate: money("rate").notNull().default(0),
  amount: money("amount").notNull().default(0),
});

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
  createdAt: created(),
  updatedAt: updated(),
});

export const bulkOrderItems = pgTable("bulk_order_items", {
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
    createdAt: created(),
  },
  (t) => [index("payments_order_idx").on(t.orderId), index("payments_bulk_idx").on(t.bulkOrderId)],
);

/* ───────────────────────── Measurements ───────────────────────── */

export const measurements = pgTable(
  "measurements",
  {
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
  },
  (t) => [index("measurements_customer_idx").on(t.customerId)],
);

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
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("cash_book_date_idx").on(t.date), uniqueIndex("cash_book_source_idx").on(t.source, t.sourceId)],
);
