import { describe, expect, it } from "vitest";
import { countSmsSegments } from "./sms-segments";

describe("SMS encoding and segment estimates", () => {
  it("counts GSM basic and concatenated messages", () => {
    expect(countSmsSegments("")).toBe(0);
    expect(countSmsSegments("A".repeat(160))).toBe(1);
    expect(countSmsSegments("A".repeat(161))).toBe(2);
    expect(countSmsSegments("A".repeat(307))).toBe(3);
  });
  it("counts extended characters as two septets", () => {
    expect(countSmsSegments("^{}\\[~]|€".repeat(9))).toBe(2);
    expect(countSmsSegments("€".repeat(80))).toBe(1);
    expect(countSmsSegments("€".repeat(81))).toBe(2);
  });
  it("uses Unicode limits for smart quotes and surrogate pairs", () => {
    expect(countSmsSegments("“".repeat(70))).toBe(1);
    expect(countSmsSegments("“".repeat(71))).toBe(2);
    expect(countSmsSegments("😀".repeat(35))).toBe(1);
    expect(countSmsSegments("😀".repeat(36))).toBe(2);
  });
});
