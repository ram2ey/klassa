ALTER TABLE "guardians" ADD COLUMN "phone_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "guardians" ADD COLUMN "phone_verified_by" text REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "guardian_consents" ADD COLUMN "sms_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sms_dispatches" ADD COLUMN "guardian_id" uuid REFERENCES "guardians"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sms_dispatches" ADD COLUMN "invitation_id" uuid REFERENCES "sms_invitations"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "sms_dispatches" ADD COLUMN "purpose" varchar(30) DEFAULT 'emergency' NOT NULL;--> statement-breakpoint
ALTER TABLE "sms_dispatches" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "sms_dispatches" ADD COLUMN "attempt_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "sms_dispatches" ADD COLUMN "leased_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sms_dispatches" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sms_dispatches" ALTER COLUMN "status" SET DEFAULT 'queued';--> statement-breakpoint
UPDATE "sms_dispatches" SET "status" = 'unverified' WHERE "status" = 'sent' AND "provider_ref" LIKE 'SM_emg_%';--> statement-breakpoint
CREATE UNIQUE INDEX "sms_dispatches_idempotency_unique" ON "sms_dispatches" ("idempotency_key");--> statement-breakpoint
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'klassa_sms_worker') THEN CREATE ROLE klassa_sms_worker NOLOGIN; END IF; END $$;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO klassa_sms_worker;--> statement-breakpoint
GRANT SELECT, UPDATE ON "sms_dispatches" TO klassa_sms_worker;--> statement-breakpoint
GRANT SELECT, UPDATE ON "sms_invitations" TO klassa_sms_worker;--> statement-breakpoint
CREATE POLICY sms_worker_scope ON "sms_dispatches" TO klassa_sms_worker USING (true) WITH CHECK (true);
