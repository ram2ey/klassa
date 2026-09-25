ALTER TABLE "students" ADD COLUMN "external_reference" varchar(100);
--> statement-breakpoint
CREATE UNIQUE INDEX "students_organization_external_reference_unique" ON "students" ("organization_id", "external_reference");
--> statement-breakpoint
CREATE TABLE "student_number_counters" (
  "organization_id" uuid PRIMARY KEY NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "next_value" bigint DEFAULT 1 NOT NULL,
  CONSTRAINT "student_number_counters_next_positive" CHECK ("next_value" > 0)
);
--> statement-breakpoint
INSERT INTO "student_number_counters" ("organization_id", "next_value")
SELECT o."id", COALESCE(MAX(
  CASE WHEN s."student_number" ~ '^ST-[0-9]{1,15}$'
    THEN substring(s."student_number" from 4)::bigint
    ELSE NULL END
), 0) + 1
FROM "organizations" o
LEFT JOIN "students" s ON s."organization_id" = o."id"
GROUP BY o."id";
