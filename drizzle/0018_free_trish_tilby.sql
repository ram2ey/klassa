ALTER TABLE "users" ADD COLUMN "last_signed_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_review_decision" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "access_reviewed_by" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_access_reviewed_by_users_id_fk" FOREIGN KEY ("access_reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "users" SET "last_signed_in_at" = recent.last_sign_in
FROM (SELECT "user_id", max("created_at") AS last_sign_in FROM "sessions" GROUP BY "user_id") AS recent
WHERE "users"."id" = recent."user_id";
