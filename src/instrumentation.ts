import { validateProductionConfiguration } from "@/lib/runtime-config";
import type { Instrumentation } from "next";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") validateProductionConfiguration();
}

export const onRequestError: Instrumentation.onRequestError = async () => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { recordPlatformRequestError } = await import("@/lib/platform-telemetry");
    await recordPlatformRequestError();
  } catch {
    // Telemetry storage must never replace or obscure the original request error.
  }
};
