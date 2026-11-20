-- One "Shirt" garment instead of "Shirt Full Sleeve" + "Shirt Half Sleeve".
-- The sleeve length moves to its own field ("Sleeve full" / "Sleeve half"); everything else is shared.
-- 1) A customer with both: their latest Full and latest Half become ONE Shirt record. For other fields filled in
--    both, the more recent record wins. The Full record is kept (now "Shirt"), the Half record is deleted.
DROP TABLE IF EXISTS "shirt_merge";
--> statement-breakpoint
CREATE TEMP TABLE "shirt_merge" AS
WITH full_l AS (
  SELECT DISTINCT ON ("customer_id") * FROM "measurements" WHERE "garment_type" = 'Shirt Full Sleeve' ORDER BY "customer_id", "date" DESC, "id" DESC
), half_l AS (
  SELECT DISTINCT ON ("customer_id") * FROM "measurements" WHERE "garment_type" = 'Shirt Half Sleeve' ORDER BY "customer_id", "date" DESC, "id" DESC
)
SELECT
  f."id" AS "keep_id",
  h."id" AS "drop_id",
  (f."date", f."id") >= (h."date", h."id") AS "full_newer",
  jsonb_strip_nulls((f."values" - 'Sleeve') || jsonb_build_object('Sleeve full', f."values" -> 'Sleeve')) AS "fv",
  jsonb_strip_nulls((h."values" - 'Sleeve') || jsonb_build_object('Sleeve half', h."values" -> 'Sleeve')) AS "hv",
  greatest(f."date", h."date") AS "new_date",
  f."size" AS "fsize", h."size" AS "hsize", f."fit" AS "ffit", h."fit" AS "hfit",
  nullif(trim(f."remarks"), '') AS "frem", nullif(trim(h."remarks"), '') AS "hrem"
FROM full_l f JOIN half_l h USING ("customer_id");
--> statement-breakpoint
UPDATE "measurements" m SET
  "garment_type" = 'Shirt',
  "values" = CASE WHEN p."full_newer" THEN p."hv" || p."fv" ELSE p."fv" || p."hv" END,
  "date" = p."new_date",
  "size" = CASE WHEN p."full_newer" THEN coalesce(p."fsize", p."hsize") ELSE coalesce(p."hsize", p."fsize") END,
  "fit" = CASE WHEN p."full_newer" THEN coalesce(p."ffit", p."hfit") ELSE coalesce(p."hfit", p."ffit") END,
  "remarks" = CASE
    WHEN p."frem" IS NOT NULL AND p."hrem" IS NOT NULL AND p."frem" <> p."hrem" THEN
      CASE WHEN p."full_newer" THEN p."frem" || ' · ' || p."hrem" ELSE p."hrem" || ' · ' || p."frem" END
    ELSE coalesce(p."frem", p."hrem") END,
  "updated_at" = now()
FROM "shirt_merge" p WHERE m."id" = p."keep_id";
--> statement-breakpoint
DELETE FROM "measurements" WHERE "id" IN (SELECT "drop_id" FROM "shirt_merge");
--> statement-breakpoint
-- 2) Every other Full / Half Sleeve record (only one kind, or older history) becomes a Shirt; the other sleeve stays empty.
DROP TABLE IF EXISTS "shirt_single";
--> statement-breakpoint
CREATE TEMP TABLE "shirt_single" AS
SELECT "id" FROM "measurements" WHERE "garment_type" IN ('Shirt Full Sleeve', 'Shirt Half Sleeve');
--> statement-breakpoint
UPDATE "measurements" SET
  "values" = ("values" - 'Sleeve') || CASE WHEN "values" ? 'Sleeve'
    THEN jsonb_build_object(CASE WHEN "garment_type" = 'Shirt Full Sleeve' THEN 'Sleeve full' ELSE 'Sleeve half' END, "values" -> 'Sleeve')
    ELSE '{}'::jsonb END,
  "garment_type" = 'Shirt',
  "updated_at" = now()
WHERE "id" IN (SELECT "id" FROM "shirt_single");
--> statement-breakpoint
-- Leave a note of what happened (shown on the Measurements page for the Owner)
INSERT INTO "audit_log" ("staff_name", "action", "entity", "summary")
SELECT 'system', 'update', 'measurement',
  'Shirt merge: ' || (SELECT count(*) FROM "shirt_merge") || ' merged (Half + Full → one Shirt), ' || (SELECT count(*) FROM "shirt_single") || ' converted to Shirt'
WHERE (SELECT count(*) FROM "shirt_merge") + (SELECT count(*) FROM "shirt_single") > 0;
--> statement-breakpoint
DROP TABLE "shirt_merge";
--> statement-breakpoint
DROP TABLE "shirt_single";
