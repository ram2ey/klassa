import { AsyncLocalStorage } from "node:async_hooks";

export type RlsContext = {
  organizationIds: string[];
  userId: string;
  platform: boolean;
};

const context = new AsyncLocalStorage<RlsContext>();

/** Start before the first await so the caller inherits this mutable request scope. */
export function beginRlsContext(): RlsContext {
  const value: RlsContext = { organizationIds: [], userId: "", platform: false };
  context.enterWith(value);
  return value;
}

export function getRlsContext(): RlsContext | undefined {
  return context.getStore();
}

export function runWithRlsContext<T>(value: RlsContext, operation: () => T): T {
  return context.run(value, operation);
}
