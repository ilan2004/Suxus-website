CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"staff_id" integer,
	"staff_name" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"summary" text
);
--> statement-breakpoint
CREATE TABLE "bulk_order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"bulk_order_id" integer NOT NULL,
	"item" text NOT NULL,
	"description" text,
	"size" text,
	"qty" integer DEFAULT 1 NOT NULL,
	"rate" numeric(12, 2) DEFAULT 0 NOT NULL,
	"amount" numeric(12, 2) DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bulk_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_no" text NOT NULL,
	"date" date NOT NULL,
	"institution" text NOT NULL,
	"address" text,
	"contact_person" text,
	"phone" text,
	"gstin" text,
	"fabric_by" text,
	"delivery_date" date,
	"status" text DEFAULT 'Booked' NOT NULL,
	"brought_by_id" integer,
	"subtotal" numeric(12, 2) DEFAULT 0 NOT NULL,
	"discount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"gst_pct" numeric(12, 2) DEFAULT 0 NOT NULL,
	"gst_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bulk_orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "cash_book" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"particulars" text NOT NULL,
	"category" text NOT NULL,
	"amount_in" numeric(12, 2) DEFAULT 0 NOT NULL,
	"amount_out" numeric(12, 2) DEFAULT 0 NOT NULL,
	"mode" text DEFAULT 'Cash' NOT NULL,
	"partner" text,
	"remarks" text,
	"source" text,
	"source_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "counters" (
	"key" text PRIMARY KEY NOT NULL,
	"value" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"place" text,
	"type" text,
	"first_visit" date,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "fabrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"barcode" text,
	"brand" text NOT NULL,
	"type" text,
	"shade" text,
	"composition" text,
	"colour_family" text,
	"supplier_id" integer,
	"purchase_date" date,
	"purchase_mtr" numeric(12, 2) DEFAULT 0 NOT NULL,
	"cost_per_mtr" numeric(12, 2) DEFAULT 0 NOT NULL,
	"sale_rate" numeric(12, 2) DEFAULT 0 NOT NULL,
	"remarks" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fabrics_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "incentive_payouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"staff_id" integer NOT NULL,
	"business" numeric(12, 2) DEFAULT 0 NOT NULL,
	"collected" numeric(12, 2) DEFAULT 0 NOT NULL,
	"rate_pct" numeric(6, 4) DEFAULT 0 NOT NULL,
	"incentive" numeric(12, 2) DEFAULT 0 NOT NULL,
	"paid" numeric(12, 2) DEFAULT 0 NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurements" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"date" date NOT NULL,
	"garment_type" text NOT NULL,
	"size" text,
	"fit" text,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opening_stock" (
	"id" serial PRIMARY KEY NOT NULL,
	"asset_type" text NOT NULL,
	"description" text NOT NULL,
	"qty" numeric(12, 2) DEFAULT 0 NOT NULL,
	"unit_value" numeric(12, 2) DEFAULT 0 NOT NULL,
	"owned_by" text NOT NULL,
	"condition" text,
	"valuation_date" date,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"item" text NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"rate" numeric(12, 2) DEFAULT 0 NOT NULL,
	"amount" numeric(12, 2) DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_no" text NOT NULL,
	"date" date NOT NULL,
	"customer_id" integer,
	"customer_name" text,
	"phone" text,
	"work_type" text NOT NULL,
	"urgency" text DEFAULT 'Normal' NOT NULL,
	"trial_date" date,
	"delivery_date" date,
	"status" text DEFAULT 'Booked' NOT NULL,
	"tailor_id" integer,
	"brought_by_id" integer,
	"sale_id" integer,
	"fabric_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"stitching_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"discount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"remarks" text,
	"photo_url" text,
	"delivered_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"kind" text NOT NULL,
	"order_id" integer,
	"bulk_order_id" integer,
	"amount" numeric(12, 2) NOT NULL,
	"mode" text DEFAULT 'Cash' NOT NULL,
	"note" text,
	"received_by_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"supplier_id" integer,
	"invoice_no" text,
	"description" text,
	"qty" numeric(12, 2) DEFAULT 0 NOT NULL,
	"rate" numeric(12, 2) DEFAULT 0 NOT NULL,
	"taxable" numeric(12, 2) DEFAULT 0 NOT NULL,
	"gst_pct" numeric(12, 2) DEFAULT 0 NOT NULL,
	"gst_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"total" numeric(12, 2) DEFAULT 0 NOT NULL,
	"paid" numeric(12, 2) DEFAULT 0 NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"fabric_id" integer,
	"description" text NOT NULL,
	"metres" numeric(12, 2) NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"amount" numeric(12, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"bill_no" text NOT NULL,
	"date" date NOT NULL,
	"customer_id" integer,
	"customer_name" text,
	"phone" text,
	"subtotal" numeric(12, 2) DEFAULT 0 NOT NULL,
	"discount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"net" numeric(12, 2) DEFAULT 0 NOT NULL,
	"payment_mode" text DEFAULT 'Cash' NOT NULL,
	"stitching_here" boolean DEFAULT false NOT NULL,
	"order_id" integer,
	"sold_by_id" integer,
	"remarks" text,
	"cancelled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_bill_no_unique" UNIQUE("bill_no")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setup_expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"paid_to" text,
	"supplier_id" integer,
	"paid_by" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"mode" text,
	"bill_no" text,
	"has_bill" boolean DEFAULT false NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"phone" text,
	"join_date" date,
	"pay_type" text,
	"monthly_salary" numeric(12, 2),
	"piece_rate" numeric(12, 2),
	"incentive" boolean DEFAULT false NOT NULL,
	"own_incentive_pct" numeric(6, 4),
	"status" text DEFAULT 'Active' NOT NULL,
	"remarks" text,
	"access" text DEFAULT 'none' NOT NULL,
	"pin_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"place" text,
	"phone" text,
	"upi" text,
	"bank" text,
	"gst_no" text,
	"supplies" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tailor_wages" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"tailor_id" integer NOT NULL,
	"order_no" text,
	"item" text NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"rate" numeric(12, 2) DEFAULT 0 NOT NULL,
	"amount" numeric(12, 2) DEFAULT 0 NOT NULL,
	"paid" numeric(12, 2) DEFAULT 0 NOT NULL,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bulk_order_items" ADD CONSTRAINT "bulk_order_items_bulk_order_id_bulk_orders_id_fk" FOREIGN KEY ("bulk_order_id") REFERENCES "public"."bulk_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulk_orders" ADD CONSTRAINT "bulk_orders_brought_by_id_staff_id_fk" FOREIGN KEY ("brought_by_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fabrics" ADD CONSTRAINT "fabrics_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incentive_payouts" ADD CONSTRAINT "incentive_payouts_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_tailor_id_staff_id_fk" FOREIGN KEY ("tailor_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_brought_by_id_staff_id_fk" FOREIGN KEY ("brought_by_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_bulk_order_id_bulk_orders_id_fk" FOREIGN KEY ("bulk_order_id") REFERENCES "public"."bulk_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_id_staff_id_fk" FOREIGN KEY ("received_by_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_fabric_id_fabrics_id_fk" FOREIGN KEY ("fabric_id") REFERENCES "public"."fabrics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_sold_by_id_staff_id_fk" FOREIGN KEY ("sold_by_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup_expenses" ADD CONSTRAINT "setup_expenses_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tailor_wages" ADD CONSTRAINT "tailor_wages_tailor_id_staff_id_fk" FOREIGN KEY ("tailor_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_at_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "cash_book_date_idx" ON "cash_book" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "cash_book_source_idx" ON "cash_book" USING btree ("source","source_id");--> statement-breakpoint
CREATE INDEX "customers_phone_idx" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "fabrics_barcode_idx" ON "fabrics" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "measurements_customer_idx" ON "measurements" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_date_idx" ON "orders" USING btree ("date");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_bulk_idx" ON "payments" USING btree ("bulk_order_id");--> statement-breakpoint
CREATE INDEX "sale_items_sale_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE INDEX "sale_items_fabric_idx" ON "sale_items" USING btree ("fabric_id");--> statement-breakpoint
CREATE INDEX "sales_date_idx" ON "sales" USING btree ("date");