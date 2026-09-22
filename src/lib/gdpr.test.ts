import { describe, it, expect } from "vitest";
import {
  generateStudentDataPortabilityPackage,
  anonymizeStudentPII,
  createGdprRequestSchema,
} from "./gdpr";

describe("Phase 6 GDPR Compliance Engine", () => {
  it("generates an Article 20 machine-readable data portability package", () => {
    const pkg = generateStudentDataPortabilityPackage("st-001", "Amelia Warren", "guardian");

    expect(pkg.exportMetadata.studentId).toBe("st-001");
    expect(pkg.exportMetadata.studentName).toBe("Amelia Warren");
    expect(pkg.demographics.grade).toBe("Grade 10");
    expect(pkg.academicHistory.cumulativeGpa).toBe(3.85);
    expect(pkg.attendanceSummary.attendanceRatePercentage).toBe(96.5);
    expect(pkg.guardians.length).toBeGreaterThan(0);
  });

  it("applies statutory safeguarding non-disclosure redaction for guardian requests", () => {
    const guardianPkg = generateStudentDataPortabilityPackage("st-001", "Amelia Warren", "guardian");
    expect(guardianPkg.exportMetadata.safeguardingRedacted).toBe(true);
    expect(guardianPkg.exportMetadata.safeguardingExemptionReason).toContain("Statutory Safeguarding Non-Disclosure");
    expect(guardianPkg.confidentialSafeguardingDossier.status).toBe("REDACTED_BY_STATUTORY_EXEMPTION");

    // When requested by DPO or legal authority, exemption reason is not set for parental non-disclosure
    const dpoPkg = generateStudentDataPortabilityPackage("st-001", "Amelia Warren", "dpo");
    expect(dpoPkg.exportMetadata.safeguardingRedacted).toBe(false);
    expect(dpoPkg.exportMetadata.safeguardingExemptionReason).toBeUndefined();
  });

  it("irreversibly pseudonymizes student PII under Article 17 Right to Erasure", () => {
    const student = {
      id: "9d78da4c-1642-4d10-ab55-7bf0388d287d",
      firstName: "Julian",
      lastName: "Assange",
      dateOfBirth: "2010-04-12",
    };

    const anonymized = anonymizeStudentPII(student);

    expect(anonymized.firstName).toBe("Anonymized");
    expect(anonymized.lastName).toBe("Student_9D78DA4C");
    expect(anonymized.dateOfBirth).toBe("1970-01-01");
    expect(anonymized.status).toBe("Withdrawn");
    expect(anonymized.isAnonymized).toBe(true);
    expect(anonymized.anonymizedAt).toBeDefined();
  });

  it("validates data subject request input with Zod", () => {
    const valid = createGdprRequestSchema.safeParse({
      studentId: "st-101",
      studentName: "Emma Stone",
      requestType: "export",
      requesterName: "John Stone",
      requesterRole: "guardian",
      requesterEmail: "john.stone@example.com",
      justification: "Annual subject access request for educational portfolio.",
    });
    expect(valid.success).toBe(true);

    const invalid = createGdprRequestSchema.safeParse({
      studentId: "st-101",
      studentName: "Emma Stone",
      requestType: "invalid_type",
      requesterName: "J",
      requesterRole: "guardian",
      requesterEmail: "invalid-email",
      justification: "short",
    });
    expect(invalid.success).toBe(false);
  });
});

