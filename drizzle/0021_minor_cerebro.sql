CREATE TYPE "public"."clinic_visit_outcome" AS ENUM('returned_to_class', 'resting_in_clinic', 'sent_home', 'collected_by_guardian', 'emergency_referral');--> statement-breakpoint
CREATE TABLE "clinic_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"attended_by" text,
	"category" varchar(60) NOT NULL,
	"symptoms" text NOT NULL,
	"treatment" text NOT NULL,
	"outcome" "clinic_visit_outcome" DEFAULT 'returned_to_class' NOT NULL,
	"guardian_notified" boolean DEFAULT false NOT NULL,
	"guardian_notification_notes" text,
	"visit_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinic_visits" ADD CONSTRAINT "clinic_visits_attended_by_users_id_fk" FOREIGN KEY ("attended_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clinic_visits_org_date_idx" ON "clinic_visits" USING btree ("organization_id","visit_date");--> statement-breakpoint
CREATE INDEX "clinic_visits_student_idx" ON "clinic_visits" USING btree ("organization_id","student_id");