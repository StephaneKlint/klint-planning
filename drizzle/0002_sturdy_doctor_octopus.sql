CREATE TABLE "app_settings" (
	"key" varchar(20) PRIMARY KEY NOT NULL,
	"logo_data_url" text,
	"logo_alt" varchar(100) DEFAULT 'Klint',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plannings" ADD COLUMN "type" varchar(20) DEFAULT 'multi' NOT NULL;