CREATE TYPE "public"."label_pos" AS ENUM('auto', 'above', 'below');--> statement-breakpoint
CREATE TYPE "public"."permission" AS ENUM('owner', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."phase_status" AS ENUM('planned', 'in_progress', 'review', 'done', 'risk', 'late');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_id" uuid NOT NULL,
	"actor_id" uuid,
	"verb" varchar(80) NOT NULL,
	"target_type" varchar(40),
	"target_id" uuid,
	"summary" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(80) NOT NULL,
	"bg" varchar(9) NOT NULL,
	"bg_alt" varchar(9) NOT NULL,
	"strong" varchar(9) NOT NULL,
	"phase_color" varchar(9) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"collapsed" boolean DEFAULT false NOT NULL,
	"cadence" jsonb DEFAULT '{"livraison":0,"pmep":10,"cab":12,"mep":15}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_id" uuid NOT NULL,
	"domain_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"subtitle" text,
	"icon" varchar(16),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestone_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"label" varchar(80) NOT NULL,
	"color" varchar(9) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"label" text NOT NULL,
	"date" date NOT NULL,
	"color" varchar(9),
	"label_pos" "label_pos" DEFAULT 'auto' NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"kind" varchar(40) NOT NULL,
	"body" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phase_assignees" (
	"phase_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	CONSTRAINT "phase_assignees_phase_id_member_id_pk" PRIMARY KEY("phase_id","member_id")
);
--> statement-breakpoint
CREATE TABLE "phase_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"label" varchar(80) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lot_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"label" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "phase_status",
	"progress" smallint DEFAULT 0 NOT NULL,
	"color" varchar(9),
	"note" text,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planning_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"permission" "permission" DEFAULT 'editor' NOT NULL,
	"project_role_id" uuid,
	"initials" varchar(3),
	"color" varchar(9)
);
--> statement-breakpoint
CREATE TABLE "planning_settings" (
	"planning_id" uuid PRIMARY KEY NOT NULL,
	"auto_late" boolean DEFAULT true NOT NULL,
	"auto_close_after_mep_days" integer DEFAULT 30 NOT NULL,
	"notify_on_late" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plannings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"year" integer NOT NULL,
	"view_start" date NOT NULL,
	"view_end" date NOT NULL,
	"reference_date" date,
	"archived" boolean DEFAULT false NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"name" varchar(80) NOT NULL,
	"color" varchar(9) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statuses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planning_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"label" varchar(80) NOT NULL,
	"color" varchar(9) NOT NULL,
	"bg" varchar(9) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" timestamp,
	"name" varchar(160) DEFAULT '' NOT NULL,
	"avatar_color" varchar(9),
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lots" ADD CONSTRAINT "lots_domain_id_domains_id_fk" FOREIGN KEY ("domain_id") REFERENCES "public"."domains"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_types" ADD CONSTRAINT "milestone_types_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_assignees" ADD CONSTRAINT "phase_assignees_phase_id_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."phases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_assignees" ADD CONSTRAINT "phase_assignees_member_id_planning_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."planning_members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phase_types" ADD CONSTRAINT "phase_types_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phases" ADD CONSTRAINT "phases_lot_id_lots_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."lots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_members" ADD CONSTRAINT "planning_members_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_members" ADD CONSTRAINT "planning_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_members" ADD CONSTRAINT "planning_members_project_role_id_project_roles_id_fk" FOREIGN KEY ("project_role_id") REFERENCES "public"."project_roles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_settings" ADD CONSTRAINT "planning_settings_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plannings" ADD CONSTRAINT "plannings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_roles" ADD CONSTRAINT "project_roles_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "statuses" ADD CONSTRAINT "statuses_planning_id_plannings_id_fk" FOREIGN KEY ("planning_id") REFERENCES "public"."plannings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "log_by_planning" ON "activity_log" USING btree ("planning_id","created_at");--> statement-breakpoint
CREATE INDEX "ms_by_lot" ON "milestones" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "phase_by_lot" ON "phases" USING btree ("lot_id");--> statement-breakpoint
CREATE INDEX "uniq_member" ON "planning_members" USING btree ("planning_id","user_id");