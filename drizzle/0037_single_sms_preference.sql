ALTER TABLE "guardian_consents" DROP COLUMN IF EXISTS "opt_in_sms_attendance";
--> statement-breakpoint
ALTER TABLE "guardian_consents" DROP COLUMN IF EXISTS "opt_in_sms_emergency";
--> statement-breakpoint
ALTER TABLE "sms_dispatches" ALTER COLUMN "purpose" SET DEFAULT 'announcement';
