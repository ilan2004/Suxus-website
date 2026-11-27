CREATE TABLE "tryon_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device" text NOT NULL,
	"ip" text,
	"fabric_id" integer,
	"garment" text NOT NULL,
	"variant" text,
	"ok" boolean NOT NULL,
	"error" text,
	"model" text NOT NULL,
	"cost_usd" numeric(10, 4) DEFAULT 0 NOT NULL,
	"ms" integer,
	"photo_id" text,
	"result_id" text
);
--> statement-breakpoint
CREATE TABLE "tryon_images" (
	"id" text PRIMARY KEY NOT NULL,
	"device" text NOT NULL,
	"kind" text NOT NULL,
	"mime" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tryon_generations" ADD CONSTRAINT "tryon_generations_fabric_id_fabrics_id_fk" FOREIGN KEY ("fabric_id") REFERENCES "public"."fabrics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tryon_generations_device_idx" ON "tryon_generations" USING btree ("device","created_at");--> statement-breakpoint
CREATE INDEX "tryon_generations_created_idx" ON "tryon_generations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tryon_images_created_idx" ON "tryon_images" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "tryon_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tryon_generations" ENABLE ROW LEVEL SECURITY;