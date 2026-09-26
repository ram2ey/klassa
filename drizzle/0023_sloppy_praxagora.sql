CREATE TYPE "public"."behaviour_type" AS ENUM('praise', 'incident');--> statement-breakpoint
CREATE TABLE "student_behaviours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid,
	"recorded_by" text,
	"type" "behaviour_type" NOT NULL,
	"category" varchar(60) NOT NULL,
	"points" integer DEFAULT 1 NOT NULL,
	"description" text,
	"guardian_visible" boolean DEFAULT true NOT NULL,
	"occurred_at" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_behaviours" ADD CONSTRAINT "student_behaviours_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_behaviours" ADD CONSTRAINT "student_behaviours_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_behaviours" ADD CONSTRAINT "student_behaviours_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_behaviours" ADD CONSTRAINT "student_behaviours_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_behaviours_org_date_idx" ON "student_behaviours" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "student_behaviours_student_idx" ON "student_behaviours" USING btree ("organization_id","student_id");--> statement-breakpoint
CREATE INDEX "student_behaviours_class_idx" ON "student_behaviours" USING btree ("organization_id","class_id");