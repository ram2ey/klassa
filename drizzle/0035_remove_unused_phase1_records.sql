DROP TABLE IF EXISTS "sen_reviews";--> statement-breakpoint
DROP TABLE IF EXISTS "sen_profiles";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."sen_tier";--> statement-breakpoint
DROP TABLE IF EXISTS "guardian_inquiry_messages";--> statement-breakpoint
DROP TABLE IF EXISTS "guardian_inquiries";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."guardian_inquiry_sender_type";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."guardian_inquiry_status";--> statement-breakpoint
DROP TABLE IF EXISTS "clinic_visits";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."clinic_visit_outcome";--> statement-breakpoint
ALTER TABLE "guardian_consents" DROP COLUMN IF EXISTS "media_consent";--> statement-breakpoint
ALTER TABLE "guardian_consents" DROP COLUMN IF EXISTS "excursion_consent";--> statement-breakpoint
ALTER TYPE "public"."staff_role" RENAME TO "staff_role_old";--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('school_admin', 'office_staff', 'teacher');--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."staff_role" USING "role"::text::"public"."staff_role";--> statement-breakpoint
ALTER TABLE "organization_memberships" ALTER COLUMN "role" TYPE "public"."staff_role" USING "role"::text::"public"."staff_role";--> statement-breakpoint
ALTER TABLE "invitations" ALTER COLUMN "role" TYPE "public"."staff_role" USING "role"::text::"public"."staff_role";--> statement-breakpoint
ALTER TABLE "sms_invitations" ALTER COLUMN "role" TYPE "public"."staff_role" USING "role"::text::"public"."staff_role";--> statement-breakpoint
DROP TYPE "public"."staff_role_old";
