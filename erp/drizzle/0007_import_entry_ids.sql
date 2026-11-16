ALTER TABLE "cash_book" ADD COLUMN "entry_id" text;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "entry_id" text;--> statement-breakpoint
ALTER TABLE "setup_expenses" ADD COLUMN "entry_id" text;--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD COLUMN "entry_id" text;