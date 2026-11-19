-- Roles: owner (everything) · partner (work side) · staff · none.
-- "Sahim KT" was the setup login with full access ("partner"): make that account the Owner.
UPDATE "staff" SET "access" = 'owner', "role" = 'Owner'
WHERE "access" = 'partner' AND lower(regexp_replace(trim("name"), '[[:space:]]+', ' ', 'g')) = 'sahim kt';
--> statement-breakpoint
-- Safety net: if no Owner exists after that (e.g. the name is spelt differently), the first full-access login becomes Owner,
-- so nobody loses Setup Expenses / Capital Account / Import after the role rules apply.
UPDATE "staff" SET "access" = 'owner', "role" = 'Owner'
WHERE "id" = (SELECT "id" FROM "staff" WHERE "access" = 'partner' AND "status" = 'Active' ORDER BY "id" LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "staff" WHERE "access" = 'owner');
