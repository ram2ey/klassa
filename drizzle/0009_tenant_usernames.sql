ALTER TABLE "users" ADD COLUMN "username" varchar(145);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_username" varchar(64);--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_unique" ON "users" USING btree ("username");
--> statement-breakpoint
-- Reserve the platform login namespace before assigning existing accounts.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM organizations WHERE lower(slug) = 'platform') THEN
    RAISE EXCEPTION 'Rename the school tenant ID platform before applying the username migration';
  END IF;
END $$;
--> statement-breakpoint
WITH admins AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS position
  FROM users WHERE is_platform_admin = true
)
UPDATE users SET
  username = 'platform:' || CASE WHEN admins.position = 1 THEN 'admin' ELSE 'admin-' || admins.position END,
  display_username = CASE WHEN admins.position = 1 THEN 'admin' ELSE 'admin-' || admins.position END
FROM admins WHERE users.id = admins.id;
--> statement-breakpoint
-- Stable, non-personal login names for existing staff. Passwords and MFA are untouched.
WITH staff AS (
  SELECT u.id, lower(o.slug) AS tenant_id,
    row_number() OVER (ORDER BY u.created_at, u.id) AS position
  FROM users u
  JOIN organizations o ON o.id = coalesce(u.organization_id,
    (SELECT m.organization_id FROM organization_memberships m WHERE m.user_id = u.id ORDER BY m.created_at, m.id LIMIT 1))
  WHERE u.is_platform_admin = false
)
UPDATE users SET username = staff.tenant_id || ':staff-' || staff.position,
  display_username = 'staff-' || staff.position
FROM staff WHERE users.id = staff.id;
