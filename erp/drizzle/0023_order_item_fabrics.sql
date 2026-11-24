CREATE TABLE "order_item_fabrics" (
	"order_item_id" integer PRIMARY KEY NOT NULL,
	"fabric_id" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_item_fabrics" ADD CONSTRAINT "order_item_fabrics_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_fabrics" ADD CONSTRAINT "order_item_fabrics_fabric_id_fabrics_id_fk" FOREIGN KEY ("fabric_id") REFERENCES "public"."fabrics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_fabrics" ENABLE ROW LEVEL SECURITY;