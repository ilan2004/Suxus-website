CREATE TABLE "supplier_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"supplier_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"mode" text DEFAULT 'Cash' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wage_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"tailor_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"mode" text DEFAULT 'Cash' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wage_payments" ADD CONSTRAINT "wage_payments_tailor_id_staff_id_fk" FOREIGN KEY ("tailor_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "supplier_payments_supplier_idx" ON "supplier_payments" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "wage_payments_tailor_idx" ON "wage_payments" USING btree ("tailor_id");