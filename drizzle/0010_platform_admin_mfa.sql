-- School accounts use tenant ID, username and password. Keep platform MFA enabled.
UPDATE "users" SET "two_factor_enabled" = false, "updated_at" = now()
WHERE "is_platform_admin" = false AND "two_factor_enabled" = true;
