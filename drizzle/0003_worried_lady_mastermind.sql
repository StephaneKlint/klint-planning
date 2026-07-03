CREATE TYPE "public"."phase_item_status" AS ENUM('todo', 'doing', 'done', 'cancelled');--> statement-breakpoint
CREATE TABLE "app_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" varchar(100) NOT NULL,
	"level" varchar(10) DEFAULT 'error' NOT NULL,
	"message" text NOT NULL,
	"details" jsonb,
	"user_id" uuid,
	"status_code" integer,
	"resolved" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "baselines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "closure_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_id" uuid NOT NULL,
	"label" varchar(100) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"color" varchar(9) DEFAULT '#FEF3C7' NOT NULL,
	"type" varchar(20) DEFAULT 'custom' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "connection_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"ip" text,
	"country" text,
	"country_code" text,
	"city" text,
	"user_agent" text,
	"is_alert" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "phase_item_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" uuid NOT NULL,
	"raw_text" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"result_json" jsonb,
	"error_msg" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "phase_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" uuid NOT NULL,
	"title" varchar(300) NOT NULL,
	"detail" text,
	"date" date,
	"status" "phase_item_status" DEFAULT 'todo' NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_id" uuid NOT NULL,
	"token" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "share_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "favicon_data_url" text;--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "permissions_json" jsonb;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "is_postponed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "postponed_note" text;--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "postponed_label_color" varchar(20);--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "postponed_label_font" varchar(80);--> statement-breakpoint
ALTER TABLE "lots" ADD COLUMN "postponed_label_size" smallint;--> statement-breakpoint
ALTER TABLE "plannings" ADD COLUMN "disabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plannings" ADD COLUMN "is_template" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "plannings" ADD COLUMN "project_name" varchar(100);--> statement-breakpoint
ALTER TABLE "plannings" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'contact' NOT NULL;--> statement-breakpoint
ALTER TABLE "app_errors" ADD CONSTRAINT "app_errors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "closure_periods" ADD CONSTRAINT "closure_periods_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_tokens" ADD CONSTRAINT "invitation_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_item_imports" ADD CONSTRAINT "phase_item_imports_phase_id_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_items" ADD CONSTRAINT "phase_items_phase_id_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_tokens" ADD CONSTRAINT "share_tokens_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ae_created" ON "app_errors" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ae_resolved" ON "app_errors" USING btree ("resolved");--> statement-breakpoint
CREATE INDEX "baselines_by_planning" ON "baselines" USING btree ("planning_id");--> statement-breakpoint
CREATE INDEX "cp_by_planning" ON "closure_periods" USING btree ("planning_id");--> statement-breakpoint
CREATE INDEX "cl_by_user" ON "connection_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cl_created" ON "connection_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "pii_status" ON "phase_item_imports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pii_by_phase" ON "phase_item_imports" USING btree ("phase_id");--> statement-breakpoint
CREATE INDEX "pi_by_phase" ON "phase_items" USING btree ("phase_id");--> statement-breakpoint
CREATE INDEX "share_tokens_by_planning" ON "share_tokens" USING btree ("planning_id");