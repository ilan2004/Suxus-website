CREATE TABLE "contact_imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"raw_phone" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"customer_id" integer,
	"source" text,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_imports" ADD CONSTRAINT "contact_imports_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contact_imports_phone_uq" ON "contact_imports" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "contact_imports_status_idx" ON "contact_imports" USING btree ("status");--> statement-breakpoint
ALTER TABLE "contact_imports" ENABLE ROW LEVEL SECURITY;
