CREATE TYPE "public"."sen_tier" AS ENUM('universal', 'targeted', 'specialist');--> statement-breakpoint
CREATE TABLE "sen_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"case_id" uuid,
	"tier" "sen_tier" DEFAULT 'targeted' NOT NULL,
	"primary_need" varchar(120) NOT NULL,
	"secondary_needs" text,
	"support_plan_summary" text NOT NULL,
	"exam_access_arrangements" text,
	"lead_specialist_id" text,
	"review_frequency_weeks" integer DEFAULT 12 NOT NULL,
	"next_review_date" date NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"status" varchar(40) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sen_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"reviewer_id" text,
	"review_date" date NOT NULL,
	"review_type" varchar(60) DEFAULT 'termly' NOT NULL,
	"attendees" text NOT NULL,
	"targets_met_summary" text NOT NULL,
	"new_targets" text NOT NULL,
	"tier_decision" "sen_tier" NOT NULL,
	"next_review_date" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sen_profiles" ADD CONSTRAINT "sen_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sen_profiles" ADD CONSTRAINT "sen_profiles_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sen_profiles" ADD CONSTRAINT "sen_profiles_case_id_sensitive_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."sensitive_cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sen_profiles" ADD CONSTRAINT "sen_profiles_lead_specialist_id_users_id_fk" FOREIGN KEY ("lead_specialist_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sen_profiles_student_unique" ON "sen_profiles" USING btree ("organization_id","student_id");--> statement-breakpoint
CREATE INDEX "sen_profiles_org_tier_idx" ON "sen_profiles" USING btree ("organization_id","tier");--> statement-breakpoint
CREATE INDEX "sen_profiles_next_review_idx" ON "sen_profiles" USING btree ("organization_id","next_review_date");--> statement-breakpoint
ALTER TABLE "sen_reviews" ADD CONSTRAINT "sen_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sen_reviews" ADD CONSTRAINT "sen_reviews_profile_id_sen_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."sen_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sen_reviews" ADD CONSTRAINT "sen_reviews_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sen_reviews" ADD CONSTRAINT "sen_reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sen_reviews_profile_idx" ON "sen_reviews" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "sen_reviews_org_date_idx" ON "sen_reviews" USING btree ("organization_id","review_date");--> statement-breakpoint
CREATE INDEX "sen_reviews_student_idx" ON "sen_reviews" USING btree ("student_id");
