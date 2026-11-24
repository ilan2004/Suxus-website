CREATE TABLE "fabric_stock_moves" (
	"id" serial PRIMARY KEY NOT NULL,
	"fabric_id" integer NOT NULL,
	"kind" text NOT NULL,
	"date" date NOT NULL,
	"metres" numeric(12, 2) NOT NULL,
	"rate" numeric(12, 2),
	"supplier_id" integer,
	"bill_no" text,
	"remarks" text,
	"bought_after" numeric(12, 2) NOT NULL,
	"balance_after" numeric(12, 2) NOT NULL,
	"rate_before" numeric(12, 2),
	"rate_after" numeric(12, 2),
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fabrics" ADD COLUMN "opening_mtr" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "fabrics" ADD COLUMN "opening_cost_per_mtr" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "fabric_stock_moves" ADD CONSTRAINT "fabric_stock_moves_fabric_id_fabrics_id_fk" FOREIGN KEY ("fabric_id") REFERENCES "public"."fabrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fabric_stock_moves" ADD CONSTRAINT "fabric_stock_moves_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fabric_stock_moves_fabric_idx" ON "fabric_stock_moves" USING btree ("fabric_id","id");--> statement-breakpoint
ALTER TABLE "fabric_stock_moves" ENABLE ROW LEVEL SECURITY;