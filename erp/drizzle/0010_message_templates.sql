CREATE TABLE "customer_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"customer_id" integer,
	"order_id" integer,
	"bulk_order_id" integer,
	"template_id" integer,
	"template_name" text,
	"phone" text NOT NULL,
	"text" text NOT NULL,
	"sent_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text DEFAULT 'Greeting' NOT NULL,
	"body" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_bulk_order_id_bulk_orders_id_fk" FOREIGN KEY ("bulk_order_id") REFERENCES "public"."bulk_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_messages" ADD CONSTRAINT "customer_messages_template_id_message_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."message_templates"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_messages_customer_idx" ON "customer_messages" USING btree ("customer_id");--> statement-breakpoint
ALTER TABLE "message_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "customer_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
INSERT INTO "message_templates" ("name", "category", "body", "sort_order") VALUES
('Greeting', 'Greeting', 'ഹായ് {name}, സുപ്രഭാതം 🌸 SUXUS HERITAGE TAILOR-ൽ നിന്നാണ്. എന്തെങ്കിലും ആവശ്യമുണ്ടെങ്കിൽ അറിയിക്കുക.', 1),
('Order booked', 'Order', '{name}, നിങ്ങളുടെ ഓർഡർ രജിസ്റ്റർ ചെയ്തു ✅
ഓർഡർ നം: {order_no} · {item}
ഡെലിവറി: {date}
— SUXUS HERITAGE TAILOR, പള്ളിക്കൽ ബസാർ', 2),
('Order ready', 'Order', '{name}, നിങ്ങളുടെ {item} തയ്യാറായി 👔
ഓർഡർ നം: {order_no}
സൗകര്യമുള്ളപ്പോൾ വന്ന് വാങ്ങാം.
— SUXUS HERITAGE TAILOR', 3),
('Payment due', 'Payment', '{name}, ഓർഡർ {order_no}-ൽ ₹{balance} ബാക്കിയുണ്ട്.
സൗകര്യം പോലെ തന്നാൽ മതി. നന്ദി 🙏
— SUXUS HERITAGE TAILOR', 4),
('Thank you after delivery', 'Order', '{name}, SUXUS തിരഞ്ഞെടുത്തതിന് നന്ദി 🙏
തുന്നലിൽ എന്തെങ്കിലും മാറ്റം വേണമെങ്കിൽ ഒരാഴ്ചയ്ക്കുള്ളിൽ അറിയിക്കുക — സൗജന്യമായി ചെയ്തുതരാം.', 5),
('New arrivals', 'Offer', '{name}, പുതിയ ഷർട്ടിംഗ് / സ്യൂട്ടിംഗ് കളക്ഷൻ എത്തിയിട്ടുണ്ട് ✨ ഒന്ന് വന്ന് നോക്കൂ.
— SUXUS HERITAGE TAILOR, പള്ളിക്കൽ ബസാർ', 6);
