import { encryptNarrative, decryptNarrative } from "./narrative-crypto";
import { describe, expect, it } from "vitest";
import {
  canUserAccessCaseArea,
  canUserManageNeedToKnow,
  canUserManageCourtOrders,
  canUserViewCourtOrderSummary,
  checkGuardianAccessRestrictions,
  generateDisclosurePackage,
  sanitizeTeacherAlert,
  createSensitiveCaseSchema,
  createNeedToKnowSchema,
  registerCourtOrderSchema,
  INITIAL_SENSITIVE_CASES,
  INITIAL_COURT_RESTRICTIONS,
  type CourtRestrictionRecord,
} from "./sensitive-records";

describe("Phase 5: Sensitive Records Cryptography (AES-256-GCM)", () => {
  it("encrypts and decrypts sensitive case narratives accurately", () => {
    const rawNarrative = "Student disclosed severe domestic dispute. Protective liaison engaged with emergency housing.";
    const encrypted = encryptNarrative(rawNarrative);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.ciphertext).not.toEqual(rawNarrative);
    expect(encrypted.ivHex).toHaveLength(24); // 12 bytes = 24 hex chars
    expect(encrypted.authTagHex).toHaveLength(32); // 16 bytes = 32 hex chars

    const decrypted = decryptNarrative(encrypted.ciphertext, encrypted.ivHex, encrypted.authTagHex);
    expect(decrypted).toEqual(rawNarrative);
  });

  it("fails to decrypt if ciphertext is tampered with (GCM authentication check)", () => {
    const rawNarrative = "Confidential clinical psychological evaluation.";
    const encrypted = encryptNarrative(rawNarrative);

    // Tamper with one character of ciphertext
    const tamperedCiphertext =
      encrypted.ciphertext.substring(0, 4) +
      (encrypted.ciphertext[4] === "a" ? "b" : "a") +
      encrypted.ciphertext.substring(5);

    expect(() => {
      decryptNarrative(tamperedCiphertext, encrypted.ivHex, encrypted.authTagHex);
    }).toThrow();
  });

  it("fails to decrypt if authentication tag does not match", () => {
    const rawNarrative = "Confidential IEP notes.";
    const encrypted = encryptNarrative(rawNarrative);
    const corruptedTag = "0".repeat(32);

    expect(() => {
      decryptNarrative(encrypted.ciphertext, encrypted.ivHex, corruptedTag);
    }).toThrow();
  });
});

describe("Phase 5: Role-Based Access Control & Case Area Matrix", () => {
  it("allows school_admin access to all case areas", () => {
    expect(canUserAccessCaseArea("school_admin", "safeguarding")).toBe(true);
    expect(canUserAccessCaseArea("school_admin", "health_medical")).toBe(true);
    expect(canUserAccessCaseArea("school_admin", "special_needs")).toBe(true);
    expect(canUserAccessCaseArea("school_admin", "disciplinary")).toBe(true);
  });

  it("restricts safeguarding_lead strictly to safeguarding, health (collaborative), and disciplinary", () => {
    expect(canUserAccessCaseArea("safeguarding_lead", "safeguarding")).toBe(true);
    expect(canUserAccessCaseArea("safeguarding_lead", "disciplinary")).toBe(true);
    expect(canUserAccessCaseArea("safeguarding_lead", "health_medical")).toBe(true);
    expect(canUserAccessCaseArea("safeguarding_lead", "special_needs")).toBe(false);
  });

  it("restricts health_nurse to medical records and blocks child protection safeguarding", () => {
    expect(canUserAccessCaseArea("health_nurse", "health_medical")).toBe(true);
    expect(canUserAccessCaseArea("health_nurse", "safeguarding")).toBe(false);
    expect(canUserAccessCaseArea("health_nurse", "special_needs")).toBe(false);
    expect(canUserAccessCaseArea("health_nurse", "disciplinary")).toBe(false);
  });

  it("restricts senco to special needs and blocks clinical/safeguarding notes", () => {
    expect(canUserAccessCaseArea("senco", "special_needs")).toBe(true);
    expect(canUserAccessCaseArea("senco", "safeguarding")).toBe(false);
    expect(canUserAccessCaseArea("senco", "health_medical")).toBe(false);
  });

  it("denies teachers and guardians all access to raw confidential cases", () => {
    expect(canUserAccessCaseArea("teacher", "safeguarding")).toBe(false);
    expect(canUserAccessCaseArea("teacher", "health_medical")).toBe(false);
    expect(canUserAccessCaseArea("teacher", "special_needs")).toBe(false);
    expect(canUserAccessCaseArea("guardian", "safeguarding")).toBe(false);
    expect(canUserAccessCaseArea("guardian", "health_medical")).toBe(false);
  });

  it("authorizes specialists for need-to-know management and restricts teachers/guardians", () => {
    expect(canUserManageNeedToKnow("school_admin")).toBe(true);
    expect(canUserManageNeedToKnow("safeguarding_lead")).toBe(true);
    expect(canUserManageNeedToKnow("health_nurse")).toBe(true);
    expect(canUserManageNeedToKnow("senco")).toBe(true);
    expect(canUserManageNeedToKnow("teacher")).toBe(false);
    expect(canUserManageNeedToKnow("guardian")).toBe(false);
  });
});

describe("Phase 5: Need-to-Know Redaction Engine", () => {
  it("allows safe instructional classroom directives", () => {
    const result = sanitizeTeacherAlert(
      "Severe peanut allergy. Inhaler stored in classroom cabinet.",
      "Administer inhaler immediately upon respiratory distress."
    );

    expect(result.flaggedLeakedContent).toBe(false);
    expect(result.directiveSummary).toContain("Severe peanut allergy");
    expect(result.actionRequired).toContain("Administer inhaler");
  });

  it("detects and redacts diagnostic or investigative terms from teacher alerts", () => {
    const result = sanitizeTeacherAlert(
      "Student under child protective services investigation regarding physical abuse allegation.",
      "Notify CPS caseworker immediately if marks observed."
    );

    expect(result.flaggedLeakedContent).toBe(true);
    expect(result.directiveSummary).not.toContain("child protective services");
    expect(result.directiveSummary).not.toContain("physical abuse allegation");
    expect(result.directiveSummary).toContain("[Protected Case Detail]");
  });
});

describe("Phase 5: Court Restrictions & Guardian Enforcement", () => {
  const sampleOrders: CourtRestrictionRecord[] = [
    {
      id: "ord-01",
      organizationId: "org-northfield",
      studentId: "st-003",
      studentName: "Lucas Vance",
      restrictedGuardianId: "grd-restricted-01",
      restrictedPersonName: "Julian Vance",
      orderType: "restraining_order",
      docketNumber: "FAM-2026-8821-RO",
      issuingCourt: "Family Court",
      summary: "Restraining order prohibiting pickup and contact.",
      prohibitPickup: true,
      prohibitDisclosure: true,
      prohibitDirectContact: true,
      effectiveDate: "2026-08-15",
      expirationDate: null,
      isEnforced: true,
      createdAt: "2026-08-20T09:30:00Z",
    },
  ];

  it("correctly identifies restricted guardians and flags all prohibitions", () => {
    const status = checkGuardianAccessRestrictions("grd-restricted-01", sampleOrders);
    expect(status.isBlocked).toBe(true);
    expect(status.prohibitPickup).toBe(true);
    expect(status.prohibitDisclosure).toBe(true);
    expect(status.prohibitDirectContact).toBe(true);
    expect(status.orders).toHaveLength(1);
  });

  it("permits unrestricted guardians without hindrance", () => {
    const status = checkGuardianAccessRestrictions("grd-authorized-99", sampleOrders);
    expect(status.isBlocked).toBe(false);
    expect(status.prohibitPickup).toBe(false);
  });

  it("verifies staff permission to view court order summaries", () => {
    expect(canUserViewCourtOrderSummary("office_staff")).toBe(true);
    expect(canUserViewCourtOrderSummary("teacher")).toBe(true);
    expect(canUserManageCourtOrders("office_staff")).toBe(false);
    expect(canUserManageCourtOrders("safeguarding_lead")).toBe(true);
  });
});

describe("Phase 5: Redacted Guardian Disclosure Package Generator", () => {
  it("generates disclosure package withholding safeguarding records from standard disclosures", () => {
    const result = generateDisclosurePackage(
      { id: "st-003", name: "Lucas Vance" },
      INITIAL_SENSITIVE_CASES,
      INITIAL_COURT_RESTRICTIONS,
      "office_staff"
    );

    expect(result.studentName).toBe("Lucas Vance");
    expect(result.withheldSafeguardingCount).toBeGreaterThanOrEqual(1);
    expect(result.digitalIntegrityChecksum).toHaveLength(16);
  });

  it("includes institutional summaries for authorized administrative disclosures", () => {
    const result = generateDisclosurePackage(
      { id: "st-001", name: "Amelia Warren" },
      INITIAL_SENSITIVE_CASES,
      [],
      "school_admin"
    );

    expect(result.includedRecords.length).toBeGreaterThanOrEqual(1);
    expect(result.includedRecords[0].redactedNotes).toContain("[Official Institutional Summary");
  });
});

describe("Phase 5: Zod Input Validation", () => {
  it("validates valid sensitive case input", () => {
    const valid = {
      studentId: "st-001",
      studentName: "Amelia Warren",
      studentGrade: "Grade 5",
      area: "health_medical",
      confidentialityTier: "confidential",
      title: "Nut Allergy Management Protocol",
      initialNarrativeNote: "EpiPen prescription verified with family physician.",
      reviewDate: "2026-11-01",
      hasCourtOrder: false,
    };

    const parsed = createSensitiveCaseSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("rejects sensitive case creation with short narrative note", () => {
    const invalid = {
      studentId: "st-001",
      studentName: "Amelia Warren",
      studentGrade: "Grade 5",
      area: "health_medical",
      title: "Allergy",
      initialNarrativeNote: "Too short",
    };

    const parsed = createSensitiveCaseSchema.safeParse(invalid);
    expect(parsed.success).toBe(false);
  });

  it("validates need-to-know teacher alert input", () => {
    const valid = {
      studentId: "st-002",
      studentName: "Elias Martin",
      studentGrade: "Grade 5",
      category: "learning_support",
      severity: "routine",
      directiveSummary: "Allow noise-cancelling headphones during independent reading.",
      actionRequired: "Provide headphones from student desk locker during silent study time.",
    };

    const parsed = createNeedToKnowSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("validates court restriction input", () => {
    const valid = {
      studentId: "st-003",
      studentName: "Lucas Vance",
      restrictedPersonName: "Julian Vance",
      orderType: "restraining_order",
      docketNumber: "FAM-2026-8821",
      issuingCourt: "Northfield Family Court",
      summary: "Full protective restraining order prohibiting school access.",
      prohibitPickup: true,
      prohibitDisclosure: true,
      prohibitDirectContact: true,
      effectiveDate: "2026-08-01",
    };

    const parsed = registerCourtOrderSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });
});

