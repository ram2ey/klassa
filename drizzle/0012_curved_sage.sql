CREATE TYPE "public"."guardian_absence_note_status" AS ENUM('submitted', 'reviewed');--> statement-breakpoint
CREATE TABLE "guardian_absence_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"absence_date" date NOT NULL,
	"reason_category" varchar(40) NOT NULL,
	"status" "guardian_absence_note_status" DEFAULT 'submitted' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guardian_absence_notes" ADD CONSTRAINT "guardian_absence_notes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_absence_notes" ADD CONSTRAINT "guardian_absence_notes_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_absence_notes" ADD CONSTRAINT "guardian_absence_notes_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_absence_notes" ADD CONSTRAINT "guardian_absence_notes_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guardian_absence_notes_org_status_idx" ON "guardian_absence_notes" USING btree ("organization_id","status","absence_date");--> statement-breakpoint
CREATE INDEX "guardian_absence_notes_student_idx" ON "guardian_absence_notes" USING btree ("organization_id","student_id","absence_date");--> statement-breakpoint
