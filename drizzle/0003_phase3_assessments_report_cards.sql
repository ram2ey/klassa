CREATE TYPE "public"."grading_scheme_type" AS ENUM('letter', 'percentage', 'standards_based');--> statement-breakpoint
CREATE TYPE "public"."assessment_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."grade_status" AS ENUM('draft', 'submitted', 'published');--> statement-breakpoint
CREATE TYPE "public"."report_card_status" AS ENUM('draft', 'approved', 'published', 'archived');--> statement-breakpoint
CREATE TABLE "grading_schemes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" "grading_scheme_type" DEFAULT 'letter' NOT NULL,
	"scale_config" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"subject_id" uuid,
	"name" varchar(100) NOT NULL,
	"weight" integer DEFAULT 25 NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"grading_scheme_id" uuid,
	"title" varchar(150) NOT NULL,
	"code" varchar(40),
	"max_score" integer DEFAULT 100 NOT NULL,
	"date_due" date NOT NULL,
	"status" "assessment_status" DEFAULT 'draft' NOT NULL,
	"created_by_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessment_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"assessment_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"percentage" numeric(5, 2) NOT NULL,
	"letter_grade" varchar(10),
	"status" "grade_status" DEFAULT 'draft' NOT NULL,
	"feedback" text,
	"graded_by" text,
	"graded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"assessment_grade_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"previous_score" numeric(5, 2) NOT NULL,
	"new_score" numeric(5, 2) NOT NULL,
	"previous_grade" varchar(10),
	"new_grade" varchar(10),
	"reason" text NOT NULL,
	"corrected_by" text,
	"corrected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"academic_year_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "report_card_status" DEFAULT 'draft' NOT NULL,
	"gpa" numeric(3, 2),
	"overall_percentage" numeric(5, 2),
	"attendance_rate" numeric(4, 1),
	"days_present" integer DEFAULT 0 NOT NULL,
	"days_absent" integer DEFAULT 0 NOT NULL,
	"days_late" integer DEFAULT 0 NOT NULL,
	"teacher_remarks" text,
	"principal_remarks" text,
	"approved_by" text,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_card_subject_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"report_card_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"teacher_id" text,
	"score_percentage" numeric(5, 2) NOT NULL,
	"letter_grade" varchar(10) NOT NULL,
	"standards_level" varchar(50),
	"comments" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "grading_schemes" ADD CONSTRAINT "grading_schemes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_categories" ADD CONSTRAINT "assessment_categories_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_categories" ADD CONSTRAINT "assessment_categories_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_categories" ADD CONSTRAINT "assessment_categories_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_category_id_assessment_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."assessment_categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_grading_scheme_id_grading_schemes_id_fk" FOREIGN KEY ("grading_scheme_id") REFERENCES "public"."grading_schemes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_grades" ADD CONSTRAINT "assessment_grades_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_grades" ADD CONSTRAINT "assessment_grades_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "public"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_grades" ADD CONSTRAINT "assessment_grades_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_grades" ADD CONSTRAINT "assessment_grades_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_corrections" ADD CONSTRAINT "grade_corrections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_corrections" ADD CONSTRAINT "grade_corrections_assessment_grade_id_assessment_grades_id_fk" FOREIGN KEY ("assessment_grade_id") REFERENCES "public"."assessment_grades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_corrections" ADD CONSTRAINT "grade_corrections_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_corrections" ADD CONSTRAINT "grade_corrections_corrected_by_users_id_fk" FOREIGN KEY ("corrected_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_academic_year_id_academic_years_id_fk" FOREIGN KEY ("academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_term_id_terms_id_fk" FOREIGN KEY ("term_id") REFERENCES "public"."terms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_cards" ADD CONSTRAINT "report_cards_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_card_subject_grades" ADD CONSTRAINT "report_card_subject_grades_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_card_subject_grades" ADD CONSTRAINT "report_card_subject_grades_report_card_id_report_cards_id_fk" FOREIGN KEY ("report_card_id") REFERENCES "public"."report_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_card_subject_grades" ADD CONSTRAINT "report_card_subject_grades_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_card_subject_grades" ADD CONSTRAINT "report_card_subject_grades_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "grading_schemes_org_idx" ON "grading_schemes" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "assessment_categories_org_year_idx" ON "assessment_categories" USING btree ("organization_id","academic_year_id");--> statement-breakpoint
CREATE INDEX "assessments_class_subject_idx" ON "assessments" USING btree ("organization_id","class_id","subject_id");--> statement-breakpoint
CREATE INDEX "assessments_term_idx" ON "assessments" USING btree ("term_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assessment_grades_student_assessment_unique" ON "assessment_grades" USING btree ("assessment_id","student_id");--> statement-breakpoint
CREATE INDEX "assessment_grades_student_idx" ON "assessment_grades" USING btree ("organization_id","student_id");--> statement-breakpoint
CREATE INDEX "grade_corrections_grade_idx" ON "grade_corrections" USING btree ("organization_id","assessment_grade_id");--> statement-breakpoint
CREATE INDEX "grade_corrections_student_idx" ON "grade_corrections" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "report_cards_student_term_version_unique" ON "report_cards" USING btree ("student_id","term_id","version");--> statement-breakpoint
CREATE INDEX "report_cards_class_term_idx" ON "report_cards" USING btree ("organization_id","class_id","term_id");--> statement-breakpoint
CREATE INDEX "report_card_subjects_card_idx" ON "report_card_subject_grades" USING btree ("report_card_id");

