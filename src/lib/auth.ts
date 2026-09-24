import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { phoneNumber, twoFactor } from "better-auth/plugins";
import { db } from "@/db";
import { schema, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthBaseURL, requireSecret } from "@/lib/runtime-config";
import { phoneNumberSchema } from "@/lib/phone";

function createAuth() {
  return betterAuth({
  appName: "Klassa",
  baseURL: getAuthBaseURL(),
  secret: requireSecret("BETTER_AUTH_SECRET"),
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
  },
  // Phone ownership is established only through a superuser-issued invitation.
  // Public OTP sign-up, phone changes and SMS password reset remain disabled.
  disabledPaths: ["/phone-number/send-otp", "/phone-number/verify", "/phone-number/request-password-reset", "/phone-number/reset-password"],
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
  plugins: [phoneNumber({
    requireVerification: true,
    phoneNumberValidator: number => /^\+[1-9]\d{7,14}$/.test(number) && phoneNumberSchema.safeParse(number).success,
    sendOTP: async () => { throw new Error("Use a school invitation to activate your phone number."); },
  }), twoFactor({ issuer: "Klassa" })],
  advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
});
}

export type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;
export function getAuth(): Auth {
  return instance ??= createAuth();
}
