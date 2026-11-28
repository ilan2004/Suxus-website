ALTER TABLE "tryon_generations" ADD COLUMN "pant_fabric_id" integer;--> statement-breakpoint
ALTER TABLE "tryon_generations" ADD COLUMN "pant_variant" text;--> statement-breakpoint
ALTER TABLE "tryon_generations" ADD CONSTRAINT "tryon_generations_pant_fabric_id_fabrics_id_fk" FOREIGN KEY ("pant_fabric_id") REFERENCES "public"."fabrics"("id") ON DELETE set null ON UPDATE no action;