DO $$ BEGIN
  CREATE TYPE "public"."gdpr_request_type" AS ENUM('export', 'rectify', 'anonymize', 'restrict');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."gdpr_request_status" AS ENUM('pending', 'in_review', 'completed', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."drill_status" AS ENUM('passed', 'failed', 'partial');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "gdpr_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"request_type" "gdpr_request_type" NOT NULL,
	"status" "gdpr_request_status" DEFAULT 'pending' NOT NULL,
	"requester_name" varchar(180) NOT NULL,
	"requester_role" varchar(80) NOT NULL,
	"requester_email" varchar(255) NOT NULL,
	"justification" text NOT NULL,
	"rectification_payload" jsonb,
	"result_export_url" text,
	"safeguarding_redacted" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"processed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "restore_drills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"drill_date" timestamp with time zone DEFAULT now() NOT NULL,
	"backup_filename" varchar(255) NOT NULL,
	"backup_size_bytes" integer NOT NULL,
	"checksum_sha256" varchar(64) NOT NULL,
	"checksum_verified" boolean DEFAULT true NOT NULL,
	"rpo_hours_validated" numeric(5, 2) NOT NULL,
	"rto_minutes_elapsed" integer NOT NULL,
	"reconciled_students" integer NOT NULL,
	"reconciled_guardians" integer NOT NULL,
	"reconciled_cases" integer NOT NULL,
	"status" "drill_status" DEFAULT 'passed' NOT NULL,
	"operator_id" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "rate_limit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid,
	"tier" varchar(50) NOT NULL,
	"client_identifier" varchar(120) NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"request_count" integer NOT NULL,
	"limit" integer NOT NULL,
	"window_seconds" integer NOT NULL,
	"blocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "gdpr_requests" ADD CONSTRAINT "gdpr_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "gdpr_requests" ADD CONSTRAINT "gdpr_requests_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "gdpr_requests" ADD CONSTRAINT "gdpr_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "restore_drills" ADD CONSTRAINT "restore_drills_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "restore_drills" ADD CONSTRAINT "restore_drills_operator_id_users_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "rate_limit_logs" ADD CONSTRAINT "rate_limit_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gdpr_requests_org_idx" ON "gdpr_requests" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gdpr_requests_student_idx" ON "gdpr_requests" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "restore_drills_org_idx" ON "restore_drills" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limit_logs_tier_idx" ON "rate_limit_logs" USING btree ("tier");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "rate_limit_logs_client_idx" ON "rate_limit_logs" USING btree ("client_identifier");

