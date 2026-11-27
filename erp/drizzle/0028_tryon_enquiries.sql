CREATE TABLE "tryon_enquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"fabric_id" integer,
	"variant" text,
	"result_id" text,
	"generation_id" integer,
	"device" text NOT NULL,
	"contacted" boolean DEFAULT false NOT NULL,
	"contacted_by" text,
	"contacted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "tryon_enquiries" ADD CONSTRAINT "tryon_enquiries_fabric_id_fabrics_id_fk" FOREIGN KEY ("fabric_id") REFERENCES "public"."fabrics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tryon_enquiries_created_idx" ON "tryon_enquiries" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "tryon_enquiries" ENABLE ROW LEVEL SECURITY;