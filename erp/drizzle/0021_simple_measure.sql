CREATE TABLE "measurement_drafts" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer NOT NULL,
	"customer_id" integer NOT NULL,
	"wearer_id" integer,
	"measurement_id" integer,
	"garment_type" text NOT NULL,
	"size" text,
	"fit" text,
	"remarks" text,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"step" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "simple_mode" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "measurement_drafts" ADD CONSTRAINT "measurement_drafts_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_drafts" ADD CONSTRAINT "measurement_drafts_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_drafts" ADD CONSTRAINT "measurement_drafts_wearer_id_wearers_id_fk" FOREIGN KEY ("wearer_id") REFERENCES "public"."wearers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_drafts" ADD CONSTRAINT "measurement_drafts_measurement_id_measurements_id_fk" FOREIGN KEY ("measurement_id") REFERENCES "public"."measurements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "measurement_drafts_staff_idx" ON "measurement_drafts" USING btree ("staff_id");--> statement-breakpoint
ALTER TABLE "measurement_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- Simple measurement mode ON for the GK account (the cutting master); everyone else keeps the detailed form
UPDATE "staff" SET "simple_mode" = true WHERE "access" <> 'owner' AND (upper(trim(coalesce("display_name", ''))) = 'GK' OR upper(trim("name")) = 'GK' OR upper("name") LIKE 'GK %');--> statement-breakpoint
INSERT INTO "audit_log" ("staff_name", "action", "entity", "summary")
SELECT 'system', 'update', 'staff',
  'Simple measurement mode: ' || coalesce((SELECT string_agg(coalesce(nullif("display_name", ''), "name") || ' (' || "name" || ')', ', ') FROM "staff" WHERE "simple_mode"), 'no GK account found — turn it on in Settings → Users') || ' switched on';
