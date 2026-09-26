CREATE TYPE "public"."day_of_week" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday');--> statement-breakpoint
CREATE TABLE "class_timetable_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"day_of_week" "day_of_week" NOT NULL,
	"period" varchar(50) NOT NULL,
	"start_time" varchar(8) NOT NULL,
	"end_time" varchar(8) NOT NULL,
	"subject_id" uuid,
	"teacher_id" text,
	"room" varchar(80),
	"building" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_timetable_periods" ADD CONSTRAINT "class_timetable_periods_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_timetable_periods" ADD CONSTRAINT "class_timetable_periods_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_timetable_periods" ADD CONSTRAINT "class_timetable_periods_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_timetable_periods" ADD CONSTRAINT "class_timetable_periods_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_timetable_org_class_idx" ON "class_timetable_periods" USING btree ("organization_id","class_id");--> statement-breakpoint
CREATE INDEX "class_timetable_class_day_idx" ON "class_timetable_periods" USING btree ("class_id","day_of_week");--> statement-breakpoint
CREATE UNIQUE INDEX "class_timetable_class_day_period_unique" ON "class_timetable_periods" USING btree ("class_id","day_of_week","period");
