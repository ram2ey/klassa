import { describe, expect, it } from "vitest";
import { canSpecialistRunCommand, specialistAreas } from "@/lib/specialist-access";

describe("specialist permissions", () => {
  it("limits each role to its case areas", () => {
    expect(specialistAreas("safeguarding_lead")).toEqual(["safeguarding", "health_medical", "disciplinary"]);
    expect(specialistAreas("senco")).toEqual(["special_needs"]);
    expect(specialistAreas("health_nurse")).toEqual(["health_medical"]);
  });
  it("allows specialist case work and only safeguarding court changes", () => {
    for (const role of ["safeguarding_lead", "senco", "health_nurse"] as const) {
      expect(canSpecialistRunCommand(role, "sensitive_note")).toBe(true);
      expect(canSpecialistRunCommand(role, "need_to_know")).toBe(true);
      expect(canSpecialistRunCommand(role, "grade_entry")).toBe(false);
      expect(canSpecialistRunCommand(role, "attendance")).toBe(false);
    }
    expect(canSpecialistRunCommand("safeguarding_lead", "court_restriction")).toBe(true);
    expect(canSpecialistRunCommand("senco", "court_restriction")).toBe(false);
    expect(canSpecialistRunCommand("health_nurse", "court_restriction_status")).toBe(false);
  });
});
