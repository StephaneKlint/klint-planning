ALTER TABLE "app_settings" ADD COLUMN "security_settings" jsonb;--> statement-breakpoint
ALTER TABLE "connection_logs" ADD COLUMN "blocked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "allow_international" boolean DEFAULT false NOT NULL;