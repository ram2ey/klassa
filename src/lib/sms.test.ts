import { describe, expect, it } from "vitest";
import { normalizePhoneNumber } from "./sms";

describe("Ghana SMS phone normalization", () => {
  it("normalizes diverse phone number formats", () => {
    expect(normalizePhoneNumber("+354 555 0192")).toBe("+3545550192");
    expect(normalizePhoneNumber("024 123 4567")).toBe("+233241234567");
    expect(normalizePhoneNumber("+1 (555) 234-5678")).toBe("+15552345678");
  });

});
