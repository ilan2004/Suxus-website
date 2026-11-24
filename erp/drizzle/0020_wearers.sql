CREATE TABLE "wearers" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer NOT NULL,
	"name" text NOT NULL,
	"relation" text DEFAULT 'Other' NOT NULL,
	"school" text,
	"note" text,
	"is_self" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "measurements" ADD COLUMN "wearer_id" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "wearer_id" integer;--> statement-breakpoint
ALTER TABLE "wearers" ADD CONSTRAINT "wearers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wearers_customer_idx" ON "wearers" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wearers_one_self_idx" ON "wearers" USING btree ("customer_id") WHERE "wearers"."is_self";--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_wearer_id_wearers_id_fk" FOREIGN KEY ("wearer_id") REFERENCES "public"."wearers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_wearer_id_wearers_id_fk" FOREIGN KEY ("wearer_id") REFERENCES "public"."wearers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wearers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Every customer gets its "Self" wearer
INSERT INTO "wearers" ("customer_id", "name", "relation", "is_self") SELECT "id", 'Self', 'Self', true FROM "customers";--> statement-breakpoint
-- Existing measurements (garment records) belong to the customer's Self wearer
UPDATE "measurements" m SET "wearer_id" = w."id" FROM "wearers" w WHERE w."customer_id" = m."customer_id" AND w."is_self" AND m."wearer_id" IS NULL;--> statement-breakpoint
-- Existing order items: the Self wearer of the order's customer (walk-in orders without a customer stay empty)
UPDATE "order_items" i SET "wearer_id" = w."id" FROM "orders" o, "wearers" w WHERE o."id" = i."order_id" AND w."customer_id" = o."customer_id" AND w."is_self" AND i."wearer_id" IS NULL;--> statement-breakpoint
-- Result for the Owner (shown on the Measurements page)
INSERT INTO "audit_log" ("staff_name", "action", "entity", "summary")
SELECT 'system', 'update', 'measurement',
  'Wearers: ' || (SELECT count(*) FROM "wearers") || ' Self wearers created; '
  || (SELECT count(*) FROM "measurements" WHERE "wearer_id" IS NOT NULL) || ' of ' || (SELECT count(*) FROM "measurements") || ' measurement records and '
  || (SELECT count(*) FROM "order_items" WHERE "wearer_id" IS NOT NULL) || ' of ' || (SELECT count(*) FROM "order_items") || ' order items moved to Self ('
  || (SELECT count(*) FROM "order_items" i JOIN "orders" o ON o."id" = i."order_id" WHERE o."customer_id" IS NULL) || ' items on walk-in orders without a customer left as they are)';
