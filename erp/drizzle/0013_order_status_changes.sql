CREATE TABLE "order_status_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"changed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_status_changes" ADD CONSTRAINT "order_status_changes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_status_changes_order_idx" ON "order_status_changes" USING btree ("order_id");--> statement-breakpoint
ALTER TABLE "order_status_changes" ENABLE ROW LEVEL SECURITY;
