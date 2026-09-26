CREATE TYPE "public"."guardian_inquiry_status" AS ENUM('open', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."guardian_inquiry_sender_type" AS ENUM('guardian', 'teacher', 'school_admin', 'office_staff');--> statement-breakpoint
CREATE TABLE "guardian_inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"guardian_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid,
	"assigned_teacher_id" text,
	"target_role" varchar(50) DEFAULT 'teacher' NOT NULL,
	"title" varchar(180) NOT NULL,
	"category" varchar(60) NOT NULL,
	"status" "guardian_inquiry_status" DEFAULT 'open' NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardian_inquiry_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"sender_type" "guardian_inquiry_sender_type" NOT NULL,
	"sender_user_id" text,
	"sender_name" varchar(180) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "guardian_inquiries" ADD CONSTRAINT "guardian_inquiries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_inquiries" ADD CONSTRAINT "guardian_inquiries_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_inquiries" ADD CONSTRAINT "guardian_inquiries_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_inquiries" ADD CONSTRAINT "guardian_inquiries_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_inquiries" ADD CONSTRAINT "guardian_inquiries_assigned_teacher_id_users_id_fk" FOREIGN KEY ("assigned_teacher_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_inquiries" ADD CONSTRAINT "guardian_inquiries_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_inquiry_messages" ADD CONSTRAINT "guardian_inquiry_messages_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_inquiry_messages" ADD CONSTRAINT "guardian_inquiry_messages_inquiry_id_guardian_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."guardian_inquiries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardian_inquiry_messages" ADD CONSTRAINT "guardian_inquiry_messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guardian_inquiries_org_status_idx" ON "guardian_inquiries" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "guardian_inquiries_student_idx" ON "guardian_inquiries" USING btree ("organization_id","student_id");--> statement-breakpoint
CREATE INDEX "guardian_inquiries_guardian_idx" ON "guardian_inquiries" USING btree ("organization_id","guardian_id");--> statement-breakpoint
CREATE INDEX "guardian_inquiries_class_idx" ON "guardian_inquiries" USING btree ("organization_id","class_id");--> statement-breakpoint
CREATE INDEX "guardian_inquiry_messages_org_inquiry_idx" ON "guardian_inquiry_messages" USING btree ("organization_id","inquiry_id");
