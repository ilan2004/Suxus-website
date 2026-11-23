CREATE TABLE "fabric_photo_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"fabric_id" integer,
	"photo_url" text,
	"original_url" text,
	"image_width" integer,
	"image_height" integer,
	"card_found" boolean NOT NULL,
	"card_long_px" numeric(8, 1),
	"card_short_px" numeric(8, 1),
	"mm_per_px" numeric(10, 5),
	"period_px" numeric(8, 2),
	"repeat_axis" text,
	"repeat_count" numeric(8, 1),
	"repeat_strength" numeric(4, 2),
	"pattern_mm" numeric(6, 1),
	"colours" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fabrics" ADD COLUMN "photo_original_urls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fabrics" ADD COLUMN "pattern" text;--> statement-breakpoint
ALTER TABLE "fabrics" ADD COLUMN "pattern_mm" numeric(6, 1);--> statement-breakpoint
ALTER TABLE "fabrics" ADD COLUMN "pattern_mm_source" text;--> statement-breakpoint
ALTER TABLE "fabrics" ADD COLUMN "dominant_hex" text;--> statement-breakpoint
ALTER TABLE "fabrics" ADD COLUMN "secondary_hexes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fabrics" ADD COLUMN "colour_sources" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fabric_photo_log" ADD CONSTRAINT "fabric_photo_log_fabric_id_fabrics_id_fk" FOREIGN KEY ("fabric_id") REFERENCES "public"."fabrics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fabric_photo_log_fabric_idx" ON "fabric_photo_log" USING btree ("fabric_id");--> statement-breakpoint
ALTER TABLE "fabric_photo_log" ENABLE ROW LEVEL SECURITY;
