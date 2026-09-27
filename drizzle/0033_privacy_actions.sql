ALTER TABLE "students" ADD COLUMN "processing_restricted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "processing_restriction_reason" text;--> statement-breakpoint
ALTER TABLE "gdpr_requests" ADD COLUMN "action_evidence" jsonb;
