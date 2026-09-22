/** Demo mode must be explicitly enabled and is never available in production. */
export function isDemoMode(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.KLASSO_DEMO_MODE === "true";
}

export function requireSecret(name: "BETTER_AUTH_SECRET" | "SENSITIVE_RECORD_ENCRYPTION_KEY"): string {
  const value = process.env[name];
  if (!value || value.length < 32 || /change-me|replace-with|fallback-development|klasso-master/i.test(value)) {
    throw new Error(`${name} must contain at least 32 characters of independently generated secret material.`);
  }
  return value;
}

export function validateProductionConfiguration(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.KLASSO_DEMO_MODE === "true") throw new Error("Demo mode is not allowed in production.");
  requireSecret("BETTER_AUTH_SECRET");
  requireSecret("SENSITIVE_RECORD_ENCRYPTION_KEY");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required in production.");
}
