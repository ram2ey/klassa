import { z } from "zod";

export const tenantIdSchema = z.string().trim().toLowerCase().min(1).max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use the tenant ID supplied by your school.");
export const schoolTenantIdSchema = tenantIdSchema.refine(value => value !== "platform", "The tenant ID platform is reserved.");
export const usernameSchema = z.string().trim().toLowerCase().min(3).max(64)
  .regex(/^[a-z0-9][a-z0-9._-]*$/, "Use 3–64 letters, numbers, dots, underscores or hyphens.");

// Better Auth's globally unique username includes the tenant namespace.
// The colon cannot appear in either input, so two schools can safely reuse a name.
export function loginUsername(tenantId: string, username: string) {
  return `${tenantIdSchema.parse(tenantId)}:${usernameSchema.parse(username)}`;
}

export function isLoginUsername(value: string) {
  const parts = value.split(":");
  return parts.length === 2 && tenantIdSchema.safeParse(parts[0]).success && usernameSchema.safeParse(parts[1]).success;
}
