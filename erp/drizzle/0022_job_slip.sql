CREATE TABLE "job_slip_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"order_item_id" integer,
	"action" text NOT NULL,
	"via" text DEFAULT 'app' NOT NULL,
	"staff_name" text,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_slip_links" (
	"id" serial PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"order_id" integer NOT NULL,
	"order_item_id" integer,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_slip_events" ADD CONSTRAINT "job_slip_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_slip_events" ADD CONSTRAINT "job_slip_events_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_slip_links" ADD CONSTRAINT "job_slip_links_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_slip_links" ADD CONSTRAINT "job_slip_links_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_slip_events_order_idx" ON "job_slip_events" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "job_slip_links_token_idx" ON "job_slip_links" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "job_slip_links_ref_idx" ON "job_slip_links" USING btree ("kind","order_id","order_item_id");--> statement-breakpoint
ALTER TABLE "job_slip_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "job_slip_events" ENABLE ROW LEVEL SECURITY;