CREATE TYPE "public"."reception_log_type" AS ENUM('late_arrival', 'early_departure');--> statement-breakpoint
CREATE TABLE "reception_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"log_type" "reception_log_type" NOT NULL,
	"log_date" date NOT NULL,
	"time_string" varchar(10) NOT NULL,
	"minutes_late" integer DEFAULT 0 NOT NULL,
	"reason" varchar(255) NOT NULL,
	"actor_person_name" varchar(180),
	"relationship" varchar(80),
	"is_excused" boolean DEFAULT false NOT NULL,
	"recorded_by" text,
	"remarks" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "reception_logs" ADD CONSTRAINT "reception_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reception_logs" ADD CONSTRAINT "reception_logs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reception_logs" ADD CONSTRAINT "reception_logs_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reception_logs_org_date_idx" ON "reception_logs" USING btree ("organization_id","log_date");--> statement-breakpoint
CREATE INDEX "reception_logs_student_idx" ON "reception_logs" USING btree ("organization_id","student_id");