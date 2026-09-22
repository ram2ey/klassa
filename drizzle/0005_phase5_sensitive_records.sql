ALTER TYPE "public"."staff_role" ADD VALUE IF NOT EXISTS 'safeguarding_lead';--> statement-breakpoint
ALTER TYPE "public"."staff_role" ADD VALUE IF NOT EXISTS 'senco';--> statement-breakpoint
ALTER TYPE "public"."staff_role" ADD VALUE IF NOT EXISTS 'health_nurse';--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."sensitive_case_area" AS ENUM('safeguarding', 'health_medical', 'special_needs', 'disciplinary');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."case_confidentiality_tier" AS ENUM('standard_sensitive', 'confidential', 'strictly_confidential');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."sensitive_case_status" AS ENUM('open', 'under_review', 'monitoring', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."need_to_know_severity" AS ENUM('routine', 'urgent', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

DO $$ BEGIN
  CREATE TYPE "public"."court_order_type" AS ENUM('restraining_order', 'custody_restriction', 'prohibited_contact', 'non_disclosure');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "sensitive_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"case_number" varchar(50) NOT NULL,
	"area" "sensitive_case_area" NOT NULL,
	"confidentiality_tier" "case_confidentiality_tier" DEFAULT 'confidential' NOT NULL,
	"title" varchar(200) NOT NULL,
	"status" "sensitive_case_status" DEFAULT 'open' NOT NULL,
	"lead_specialist_id" text,
	"has_court_order" boolean DEFAULT false NOT NULL,
	"review_date" date,
	"closed_at" timestamp with time zone,
	"closed_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sensitive_case_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"author_id" text,
	"note_type" varchar(80) DEFAULT 'clinical_observation' NOT NULL,
	"confidentiality_tier" "case_confidentiality_tier" DEFAULT 'confidential' NOT NULL,
	"encrypted_ciphertext" text NOT NULL,
	"iv_hex" varchar(64) NOT NULL,
	"auth_tag_hex" varchar(64) NOT NULL,
	"is_quarantined" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sensitive_access_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"case_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"action" varchar(50) DEFAULT 'view_decrypted' NOT NULL,
	"access_reason" text NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "need_to_know_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"case_id" uuid,
	"category" varchar(60) NOT NULL,
	"severity" "need_to_know_severity" DEFAULT 'routine' NOT NULL,
	"directive_summary" varchar(255) NOT NULL,
	"action_required" text NOT NULL,
	"author_specialist_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "court_restrictions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"restricted_guardian_id" uuid,
	"restricted_person_name" varchar(180) NOT NULL,
	"order_type" "court_order_type" DEFAULT 'restraining_order' NOT NULL,
	"docket_number" varchar(100) NOT NULL,
	"issuing_court" varchar(180) NOT NULL,
	"summary" text NOT NULL,
	"prohibit_pickup" boolean DEFAULT true NOT NULL,
	"prohibit_disclosure" boolean DEFAULT true NOT NULL,
	"prohibit_direct_contact" boolean DEFAULT true NOT NULL,
	"effective_date" date NOT NULL,
	"expiration_date" date,
	"is_enforced" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sensitive_cases" ADD CONSTRAINT "sensitive_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensitive_cases" ADD CONSTRAINT "sensitive_cases_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensitive_cases" ADD CONSTRAINT "sensitive_cases_lead_specialist_id_users_id_fk" FOREIGN KEY ("lead_specialist_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensitive_case_notes" ADD CONSTRAINT "sensitive_case_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensitive_case_notes" ADD CONSTRAINT "sensitive_case_notes_case_id_sensitive_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."sensitive_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensitive_case_notes" ADD CONSTRAINT "sensitive_case_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensitive_access_logs" ADD CONSTRAINT "sensitive_access_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensitive_access_logs" ADD CONSTRAINT "sensitive_access_logs_case_id_sensitive_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."sensitive_cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sensitive_access_logs" ADD CONSTRAINT "sensitive_access_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_to_know_alerts" ADD CONSTRAINT "need_to_know_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_to_know_alerts" ADD CONSTRAINT "need_to_know_alerts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_to_know_alerts" ADD CONSTRAINT "need_to_know_alerts_case_id_sensitive_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."sensitive_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "need_to_know_alerts" ADD CONSTRAINT "need_to_know_alerts_author_specialist_id_users_id_fk" FOREIGN KEY ("author_specialist_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_restrictions" ADD CONSTRAINT "court_restrictions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_restrictions" ADD CONSTRAINT "court_restrictions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "court_restrictions" ADD CONSTRAINT "court_restrictions_restricted_guardian_id_guardians_id_fk" FOREIGN KEY ("restricted_guardian_id") REFERENCES "public"."guardians"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sensitive_cases_case_num_unique" ON "sensitive_cases" ("organization_id", "case_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_cases_org_area_idx" ON "sensitive_cases" ("organization_id", "area");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_cases_org_student_idx" ON "sensitive_cases" ("organization_id", "student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_notes_case_idx" ON "sensitive_case_notes" ("case_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_access_logs_case_idx" ON "sensitive_access_logs" ("case_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sensitive_access_logs_user_idx" ON "sensitive_access_logs" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "need_to_know_student_idx" ON "need_to_know_alerts" ("organization_id", "student_id", "is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "court_restrictions_student_idx" ON "court_restrictions" ("organization_id", "student_id");

