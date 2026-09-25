import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username, twoFactor } from "better-auth/plugins";
import { db } from "@/db";
import { schema, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthBaseURL, requireSecret } from "@/lib/runtime-config";
import { isLoginUsername } from "@/lib/login-identity";

function createAuth() {
  return betterAuth({
  appName: "Klassa",
  baseURL: getAuthBaseURL(),
  secret: requireSecret("BETTER_AUTH_SECRET"),
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: false,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  // Accounts and tenant-scoped login names are assigned by administrators.
  disabledPaths: ["/sign-in/email", "/sign-up/email", "/update-user", "/is-username-available"],
  hooks: { before: createAuthMiddleware(async context => {
    if (!context.path.startsWith("/two-factor/")) return;
    const session = await getSessionFromCtx(context);
    if (session && session.user.isPlatformAdmin !== true) {
      throw new APIError("FORBIDDEN", { message: "Authenticator access is reserved for platform administrators." });
    }
  }) },
  session: { additionalFields: { activeOrganizationId: { type: "string", required: false, input: false } } },
  databaseHooks: { user: { update: { after: async (user, context) => {
    // Initial TOTP verification creates a fresh session after this hook. Remove
    // every pre-enrollment session so none gains access merely when MFA becomes enabled.
    if (context?.path === "/two-factor/verify-totp" && user.twoFactorEnabled === true) {
      await db.delete(sessions).where(eq(sessions.userId, user.id));
    }
  } } } },
  user: {
    modelName: "user",
    additionalFields: {
      organizationId: { type: "string", required: false, input: false },
      role: { type: "string", required: false, input: false },
      isPlatformAdmin: { type: "boolean", required: false, input: false },
      mustChangePassword: { type: "boolean", required: false, input: false },
    },
  },
  plugins: [username({
    minUsernameLength: 5,
    maxUsernameLength: 145,
    usernameValidator: isLoginUsername,
  }), twoFactor({ issuer: "Klassa" })],
  advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
});
}

export type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;
export function getAuth(): Auth {
  return instance ??= createAuth();
}
