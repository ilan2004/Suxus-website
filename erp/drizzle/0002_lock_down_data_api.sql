-- Supabase exposes the public schema through its Data API (PostgREST).
-- The ERP talks to Postgres directly as the owner role (which bypasses RLS),
-- so enabling RLS with no policies blocks the public API without affecting the app.
ALTER TABLE "settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "counters" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "audit_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "staff" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "customers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "fabrics" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sales" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "sale_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "bulk_orders" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "bulk_order_items" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "measurements" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "purchases" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tailor_wages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "incentive_payouts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "setup_expenses" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "opening_stock" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "cash_book" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "supplier_payments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "wage_payments" ENABLE ROW LEVEL SECURITY;
