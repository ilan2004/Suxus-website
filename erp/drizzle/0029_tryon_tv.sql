ALTER TABLE "tryon_generations" ADD COLUMN "on_display" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tryon_generations" ADD COLUMN "display_at" timestamp with time zone;