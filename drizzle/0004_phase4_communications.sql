CREATE TYPE "public"."announcement_target" AS ENUM('school', 'grade', 'class');--> statement-breakpoint
CREATE TYPE "public"."announcement_priority" AS ENUM('normal', 'urgent', 'emergency');--> statement-breakpoint
CREATE TYPE "public"."announcement_status" AS ENUM('draft', 'scheduled', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."delivery_channel" AS ENUM('in_app', 'sms', 'both');--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(200) NOT NULL,
	"content" text NOT NULL,
	"target_type" "announcement_target" DEFAULT 'school' NOT NULL,
	"target_id" varchar(80) DEFAULT 'all' NOT NULL,
	"priority" "announcement_priority" DEFAULT 'normal' NOT NULL,
	"channels" "delivery_channel" DEFAULT 'in_app' NOT NULL,
	"status" "announcement_status" DEFAULT 'draft' NOT NULL,
	"requires_two_party" boolean DEFAULT false NOT NULL,
	"first_approver_id" text,
	"second_approver_id" text,
	"scheduled_for" timestamp with time zone,
	"published_at" timestamp with time zone,
	"author_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"announcement_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardian_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"phone" varchar(40) NOT NULL,
	"opt_in_sms_announcements" boolean DEFAULT true NOT NULL,
	"opt_in_sms_attendance" boolean DEFAULT true NOT NULL,
	"opt_in_sms_emergency" boolean DEFAULT true NOT NULL,
	"opt_out_reason" text,
	"opt_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"category" varchar(60) NOT NULL,
	"content_template" text NOT NULL,
	"default_priority" "announcement_priority" DEFAULT 'normal' NOT NULL,
	"suggested_channel" "delivery_channel" DEFAULT 'in_app' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_first_approver_id_user_id_fk" FOREIGN KEY ("first_approver_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_second_approver_id_user_id_fk" FOREIGN KEY ("second_approver_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_announcement_id_announcements_id_fk" FOREIGN KEY ("announcement_id") REFERENCES "public"."announcements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcement_reads" ADD CONSTRAINT "announcement_reads_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_consents" ADD CONSTRAINT "guardian_consents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_consents" ADD CONSTRAINT "guardian_consents_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_org_status_idx" ON "announcements" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "announcements_target_idx" ON "announcements" USING btree ("organization_id","target_type","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "announcement_reads_unique" ON "announcement_reads" USING btree ("announcement_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "guardian_consents_guardian_unique" ON "guardian_consents" USING btree ("organization_id","guardian_id");--> statement-breakpoint
CREATE INDEX "comm_templates_org_cat_idx" ON "communication_templates" USING btree ("organization_id","category");

