ALTER TABLE "order_items" ADD COLUMN "tailor_id" integer;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_tailor_id_staff_id_fk" FOREIGN KEY ("tailor_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Recorded wage total BEFORE (for the report — this migration does not touch tailor_wages)
INSERT INTO "audit_log" ("staff_name", "action", "entity", "summary")
SELECT 'system', 'update', 'order', 'Tailor per item — wages before: ₹' || coalesce(sum("amount"), 0) || ' over ' || count(*) || ' wage line(s)' FROM "tailor_wages";
--> statement-breakpoint
-- Copy each order's tailor onto every item of that order, so nothing changes by itself
INSERT INTO "audit_log" ("staff_name", "action", "entity", "summary")
SELECT 'system', 'update', 'order', 'Tailor per item — ' || count(DISTINCT o."id") || ' order(s) migrated, ' || count(oi."id") || ' item(s) given the order''s tailor'
FROM "orders" o JOIN "order_items" oi ON oi."order_id" = o."id" WHERE o."tailor_id" IS NOT NULL;
--> statement-breakpoint
UPDATE "order_items" oi SET "tailor_id" = o."tailor_id" FROM "orders" o WHERE oi."order_id" = o."id" AND o."tailor_id" IS NOT NULL AND oi."tailor_id" IS NULL;
--> statement-breakpoint
INSERT INTO "audit_log" ("staff_name", "action", "entity", "summary")
SELECT 'system', 'update', 'order', 'Tailor per item — wages after: ₹' || coalesce(sum("amount"), 0) || ' over ' || count(*) || ' wage line(s)' FROM "tailor_wages";
