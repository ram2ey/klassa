import { validateProductionConfiguration } from "@/lib/runtime-config";

export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") validateProductionConfiguration();
}
