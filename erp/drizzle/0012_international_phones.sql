ALTER TABLE "contact_imports" ADD COLUMN "phone2" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "alt_phone" text;
--> statement-breakpoint
-- Existing numbers were all Indian (stored as 10 digits): give them their +91 so every number is international.
UPDATE "customers" SET phone = CASE
  WHEN regexp_replace(phone, '[[:space:]().-]', '', 'g') ~ '^\+[1-9][0-9]{6,14}$' THEN regexp_replace(phone, '[[:space:]().-]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[6-9][0-9]{9}$' THEN '+91' || regexp_replace(phone, '[^0-9]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^91[6-9][0-9]{9}$' THEN '+' || regexp_replace(phone, '[^0-9]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^0[6-9][0-9]{9}$' THEN '+91' || substr(regexp_replace(phone, '[^0-9]', '', 'g'), 2)
  ELSE phone END
WHERE phone IS NOT NULL;
--> statement-breakpoint
UPDATE "orders" SET phone = CASE
  WHEN regexp_replace(phone, '[[:space:]().-]', '', 'g') ~ '^\+[1-9][0-9]{6,14}$' THEN regexp_replace(phone, '[[:space:]().-]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[6-9][0-9]{9}$' THEN '+91' || regexp_replace(phone, '[^0-9]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^91[6-9][0-9]{9}$' THEN '+' || regexp_replace(phone, '[^0-9]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^0[6-9][0-9]{9}$' THEN '+91' || substr(regexp_replace(phone, '[^0-9]', '', 'g'), 2)
  ELSE phone END
WHERE phone IS NOT NULL;
--> statement-breakpoint
UPDATE "bulk_orders" SET phone = CASE
  WHEN regexp_replace(phone, '[[:space:]().-]', '', 'g') ~ '^\+[1-9][0-9]{6,14}$' THEN regexp_replace(phone, '[[:space:]().-]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[6-9][0-9]{9}$' THEN '+91' || regexp_replace(phone, '[^0-9]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^91[6-9][0-9]{9}$' THEN '+' || regexp_replace(phone, '[^0-9]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^0[6-9][0-9]{9}$' THEN '+91' || substr(regexp_replace(phone, '[^0-9]', '', 'g'), 2)
  ELSE phone END
WHERE phone IS NOT NULL;
--> statement-breakpoint
UPDATE "sales" SET phone = CASE
  WHEN regexp_replace(phone, '[[:space:]().-]', '', 'g') ~ '^\+[1-9][0-9]{6,14}$' THEN regexp_replace(phone, '[[:space:]().-]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[6-9][0-9]{9}$' THEN '+91' || regexp_replace(phone, '[^0-9]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^91[6-9][0-9]{9}$' THEN '+' || regexp_replace(phone, '[^0-9]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^0[6-9][0-9]{9}$' THEN '+91' || substr(regexp_replace(phone, '[^0-9]', '', 'g'), 2)
  ELSE phone END
WHERE phone IS NOT NULL;
--> statement-breakpoint
UPDATE "customer_messages" SET phone = CASE
  WHEN regexp_replace(phone, '[[:space:]().-]', '', 'g') ~ '^\+[1-9][0-9]{6,14}$' THEN regexp_replace(phone, '[[:space:]().-]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[6-9][0-9]{9}$' THEN '+91' || regexp_replace(phone, '[^0-9]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^91[6-9][0-9]{9}$' THEN '+' || regexp_replace(phone, '[^0-9]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^0[6-9][0-9]{9}$' THEN '+91' || substr(regexp_replace(phone, '[^0-9]', '', 'g'), 2)
  ELSE phone END
WHERE phone IS NOT NULL;
--> statement-breakpoint
UPDATE "contact_imports" SET phone = CASE
  WHEN regexp_replace(phone, '[[:space:]().-]', '', 'g') ~ '^\+[1-9][0-9]{6,14}$' THEN regexp_replace(phone, '[[:space:]().-]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[6-9][0-9]{9}$' THEN '+91' || regexp_replace(phone, '[^0-9]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^91[6-9][0-9]{9}$' THEN '+' || regexp_replace(phone, '[^0-9]', '', 'g')
  WHEN regexp_replace(phone, '[^0-9]', '', 'g') ~ '^0[6-9][0-9]{9}$' THEN '+91' || substr(regexp_replace(phone, '[^0-9]', '', 'g'), 2)
  ELSE phone END
WHERE phone IS NOT NULL;
