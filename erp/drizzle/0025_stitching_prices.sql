CREATE TABLE "stitching_prices" (
	"id" serial PRIMARY KEY NOT NULL,
	"garment" text NOT NULL,
	"variant" text DEFAULT '' NOT NULL,
	"customer_rate" numeric(12, 2),
	"bulk_rate" numeric(12, 2),
	"active" boolean DEFAULT true NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "list_rate" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "rate_changed_by" text;--> statement-breakpoint
ALTER TABLE "bulk_order_items" ADD COLUMN "variant" text;--> statement-breakpoint
ALTER TABLE "bulk_order_items" ADD COLUMN "list_rate" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "bulk_order_items" ADD COLUMN "rate_changed_by" text;--> statement-breakpoint
CREATE UNIQUE INDEX "stitching_prices_garment_variant_idx" ON "stitching_prices" USING btree ("garment","variant");--> statement-breakpoint
ALTER TABLE "stitching_prices" ENABLE ROW LEVEL SECURITY;