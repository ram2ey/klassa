CREATE TABLE "emergency_broadcasts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "requested_by" text NOT NULL REFERENCES "users"("id"),
  "approved_by" text REFERENCES "users"("id"),
  "approved_at" timestamp with time zone,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "scope" varchar(20) NOT NULL,
  "target_id" text NOT NULL,
  "severity" varchar(30) NOT NULL,
  "reason" text NOT NULL,
  "message" text NOT NULL,
  "student_ids" jsonb NOT NULL,
  "unreachable_student_ids" jsonb NOT NULL,
  "recipient_count" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "emergency_broadcasts_org_status_idx" ON "emergency_broadcasts" ("organization_id", "status");--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "emergency_broadcasts" TO klassa_app;--> statement-breakpoint
ALTER TABLE "emergency_broadcasts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY emergency_broadcasts_tenant ON "emergency_broadcasts" TO klassa_app
  USING (current_setting('app.platform_access', true) = 'true' OR organization_id = ANY(COALESCE(string_to_array(NULLIF(current_setting('app.organization_ids', true), ''), ',')::uuid[], ARRAY[]::uuid[])))
  WITH CHECK (current_setting('app.platform_access', true) = 'true' OR organization_id = ANY(COALESCE(string_to_array(NULLIF(current_setting('app.organization_ids', true), ''), ',')::uuid[], ARRAY[]::uuid[])));
