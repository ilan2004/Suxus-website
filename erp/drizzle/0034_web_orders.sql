CREATE TABLE "web_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"pincode" text NOT NULL,
	"note" text,
	"unit" text NOT NULL,
	"items" jsonb NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"customer_id" integer,
	"handled_by" text,
	"handled_at" timestamp with time zone,
	"ip" text
);
--> statement-breakpoint
ALTER TABLE "web_orders" ADD CONSTRAINT "web_orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "web_orders_created_idx" ON "web_orders" USING btree ("created_at");