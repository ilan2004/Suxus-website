ALTER TABLE "fabrics" ADD COLUMN "suitable_for" text DEFAULT 'both' NOT NULL;--> statement-breakpoint
ALTER TABLE "fabrics" ADD COLUMN "colour_bucket" text;
