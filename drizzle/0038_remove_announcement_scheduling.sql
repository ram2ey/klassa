UPDATE "announcements" SET "status" = 'draft' WHERE "status"::text IN ('scheduled', 'pending_approval');--> statement-breakpoint
ALTER TABLE "announcements" DROP COLUMN "requires_two_party";--> statement-breakpoint
ALTER TABLE "announcements" DROP COLUMN "first_approver_id";--> statement-breakpoint
ALTER TABLE "announcements" DROP COLUMN "second_approver_id";--> statement-breakpoint
ALTER TABLE "announcements" DROP COLUMN "scheduled_for";--> statement-breakpoint
ALTER TYPE "announcement_status" RENAME TO "announcement_status_old";--> statement-breakpoint
CREATE TYPE "announcement_status" AS ENUM ('draft', 'published', 'archived');--> statement-breakpoint
ALTER TABLE "announcements" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "announcements" ALTER COLUMN "status" TYPE "announcement_status" USING ("status"::text::"announcement_status");--> statement-breakpoint
ALTER TABLE "announcements" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
DROP TYPE "announcement_status_old";
