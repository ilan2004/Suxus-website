ALTER TABLE "fabrics" ADD COLUMN "photo_urls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fabrics" ADD COLUMN "thumb_urls" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "fabrics" ADD COLUMN "thumbnail_url" text;