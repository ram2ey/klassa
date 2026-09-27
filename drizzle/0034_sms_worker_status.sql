CREATE TABLE "sms_worker_status" (
  "id" integer PRIMARY KEY,
  "heartbeat_at" timestamp with time zone,
  "queued_count" integer DEFAULT 0 NOT NULL,
  "failed_count" integer DEFAULT 0 NOT NULL,
  "unknown_count" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
INSERT INTO "sms_worker_status" ("id") VALUES (1);--> statement-breakpoint
GRANT SELECT ON "sms_worker_status" TO klassa_app;--> statement-breakpoint
GRANT SELECT, UPDATE ON "sms_worker_status" TO klassa_sms_worker;
