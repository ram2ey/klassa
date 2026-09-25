ALTER TABLE "organizations" ALTER COLUMN "timezone" SET DEFAULT 'Etc/GMT';--> statement-breakpoint
UPDATE "organizations" SET "timezone" = 'Etc/GMT' WHERE "timezone" <> 'Etc/GMT';
