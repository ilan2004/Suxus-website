CREATE TABLE "import_deleted" (
	"entity" text NOT NULL,
	"entry_id" text NOT NULL,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "import_deleted_pk" ON "import_deleted" USING btree ("entity","entry_id");--> statement-breakpoint
ALTER TABLE "import_deleted" ENABLE ROW LEVEL SECURITY;
