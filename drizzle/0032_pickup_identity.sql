ALTER TABLE "reception_logs" ADD COLUMN "collector_guardian_id" uuid REFERENCES "guardians"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "reception_logs" ADD COLUMN "identity_document_type" varchar(60);--> statement-breakpoint
ALTER TABLE "reception_logs" ADD COLUMN "identity_document_last4" varchar(4);--> statement-breakpoint
ALTER TABLE "reception_logs" ADD COLUMN "identity_checked" boolean DEFAULT false NOT NULL;
