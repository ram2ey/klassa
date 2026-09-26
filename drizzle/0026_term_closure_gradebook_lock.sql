ALTER TABLE "terms" ADD COLUMN "is_locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "terms" ADD COLUMN "locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "terms" ADD COLUMN "locked_by_id" text;--> statement-breakpoint
ALTER TABLE "terms" ADD COLUMN "lock_notes" text;--> statement-breakpoint
ALTER TABLE "terms" ADD CONSTRAINT "terms_locked_by_id_users_id_fk" FOREIGN KEY ("locked_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "terms_locked_idx" ON "terms" USING btree ("organization_id","is_locked");
