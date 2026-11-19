ALTER TABLE "bulk_orders" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "updated_by" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "failed_pins" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "session_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "wage_payments" ADD COLUMN "created_by" text;--> statement-breakpoint
-- Payments already knew who received them: show that as "by …".
UPDATE "payments" SET "created_by" = (SELECT coalesce("display_name", "name") FROM "staff" WHERE "staff"."id" = "payments"."received_by_id") WHERE "created_by" IS NULL AND "received_by_id" IS NOT NULL;
