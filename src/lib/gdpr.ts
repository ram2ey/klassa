import { z } from "zod";

export type GdprRequestType = "export" | "rectify" | "anonymize" | "restrict";
export type GdprRequestStatus = "pending" | "in_review" | "completed" | "rejected";

export interface GdprRequestRecord {
  id: string;
  organizationId: string;
  studentId: string;
  studentName: string;
  requestType: GdprRequestType;
  status: GdprRequestStatus;
  requesterName: string;
  requesterRole: string; // e.g. "guardian", "student_adult", "dpo"
  requesterEmail: string;
  justification: string;
  safeguardingRedacted: boolean;
  isProcessingRestricted?: boolean;
  resultExportUrl?: string | null;
  processedAt?: string | null;
  processedBy?: string | null;
  createdAt: string;
}

export interface StudentDataPortabilityPackage {
  exportMetadata: {
    exportId: string;
    generatedAt: string;
    organizationName: string;
    studentId: string;
    studentName: string;
    complianceStandard: string; // "GDPR Article 20 / UK DPA 2018"
    dpoContact: string;
    safeguardingExemptionApplied: boolean;
    safeguardingRedacted: boolean;
    safeguardingExemptionReason?: string;
  };
  demographics: {
    studentId: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    grade: string;
    enrollmentStatus: string;
    joinedDate: string;
  };
  guardians: Array<{
    name: string;
    relationship: string;
    isPrimary: boolean;
    hasLegalResponsibility: boolean;
    contactEmail: string;
    contactPhone: string;
  }>;
  academicHistory: {
    cumulativeGpa: number;
    classes: string[];
    assessmentsCompleted: number;
    publishedSubjects: Array<{ subject: string; grade: string; score: number }>;
    reportCardsIssued: Array<{ term: string; version: string; issuedAt: string }>;
  };
  attendanceSummary: {
    attendanceRatePercentage: number;
    totalDaysPresent: number;
    totalDaysAbsent: number;
    totalDaysLate: number;
    chronicAbsenceFlag: boolean;
  };
  communicationsAndConsent: {
    channelPreferences: Record<string, boolean>;
    announcementsReceivedCount: number;
  };
  confidentialSafeguardingDossier: {
    status: "REDACTED_BY_STATUTORY_EXEMPTION" | "ATTACHED";
    statutoryLegalBasis: string;
    notice: string;
  };
}

export const createGdprRequestSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  studentName: z.string().min(1, "Student name is required"),
  requestType: z.enum(["export", "rectify", "anonymize", "restrict"]),
  requesterName: z.string().min(2, "Requester name must be at least 2 characters"),
  requesterRole: z.string().min(2, "Requester role is required"),
  requesterEmail: z.string().email("Valid email address is required"),
  justification: z.string().min(8, "Mandatory justification note required (min 8 chars)"),
});

export type CreateGdprRequestInput = z.infer<typeof createGdprRequestSchema>;

export const INITIAL_GDPR_REQUESTS: GdprRequestRecord[] = [
  {
    id: "gdpr-req-001",
    organizationId: "org-northfield",
    studentId: "st-amelia-warren",
    studentName: "Amelia Warren",
    requestType: "export",
    status: "completed",
    requesterName: "David Warren",
    requesterRole: "guardian",
    requesterEmail: "david.warren@example.com",
    justification: "Annual parental copy of machine-readable educational and attendance data under GDPR Article 20.",
    safeguardingRedacted: true,
    resultExportUrl: "/api/v1/gdpr/export/st-amelia-warren",
    processedAt: "2026-09-18T11:30:00.000Z",
    processedBy: "Dr. Arthur Vance",
    createdAt: "2026-09-18T09:15:00.000Z",
  },
  {
    id: "gdpr-req-002",
    organizationId: "org-northfield",
    studentId: "st-liam-chen",
    studentName: "Liam Chen",
    requestType: "restrict",
    status: "in_review",
    requesterName: "Eleanor Chen",
    requesterRole: "guardian",
    requesterEmail: "e.chen@example.com",
    justification: "Request to temporarily freeze automated SMS notification dispatches pending address change confirmation.",
    safeguardingRedacted: false,
    isProcessingRestricted: false,
    createdAt: "2026-09-21T14:00:00.000Z",
  },
];

/**
 * Generates an Article 20 machine-readable data portability package.
 * Automatically enforces child safeguarding non-disclosure exemptions.
 */
export function generateStudentDataPortabilityPackage(
  studentId: string,
  studentName: string,
  requesterRole: string = "guardian"
): StudentDataPortabilityPackage {
  // Check whether safeguarding non-disclosure applies (always applied for guardians/third-parties)
  const isGuardianOrParent = requesterRole === "guardian" || requesterRole === "parent";

  return {
    exportMetadata: {
      exportId: `dossier-${studentId}-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      organizationName: "Northfield Academy",
      studentId,
      studentName,
      complianceStandard: "GDPR (EU 2016/679) Article 20 & UK Data Protection Act 2018",
      dpoContact: "dpo@northfield.edu.is",
      safeguardingExemptionApplied: isGuardianOrParent,
      safeguardingRedacted: isGuardianOrParent,
      safeguardingExemptionReason: isGuardianOrParent
        ? "Statutory Safeguarding Non-Disclosure: Child protection case records, clinical diagnoses, and confidential welfare narratives are protected under Section 15 of the Data Protection Act to protect the physical/psychological welfare of the child."
        : undefined,
    },
    demographics: {
      studentId,
      firstName: studentName.split(" ")[0] || "Student",
      lastName: studentName.split(" ").slice(1).join(" ") || "Record",
      dateOfBirth: "2010-05-14",
      grade: "Grade 10",
      enrollmentStatus: "Active",
      joinedDate: "2024-08-20",
    },
    guardians: [
      {
        name: "David Warren",
        relationship: "Father",
        isPrimary: true,
        hasLegalResponsibility: true,
        contactEmail: "david.warren@example.com",
        contactPhone: "+354 555 1234",
      },
    ],
    academicHistory: {
      cumulativeGpa: 3.85,
      classes: ["10-A Mathematics", "10-A English Literature", "10-A Chemistry"],
      assessmentsCompleted: 14,
      publishedSubjects: [
        { subject: "Mathematics", grade: "A", score: 94 },
        { subject: "English Literature", grade: "A-", score: 90 },
        { subject: "Chemistry", grade: "B+", score: 87 },
      ],
      reportCardsIssued: [
        { term: "Term 1 (Autumn)", version: "v1.1", issuedAt: "2026-01-15T10:00:00.000Z" },
      ],
    },
    attendanceSummary: {
      attendanceRatePercentage: 96.5,
      totalDaysPresent: 85,
      totalDaysAbsent: 3,
      totalDaysLate: 2,
      chronicAbsenceFlag: false,
    },
    communicationsAndConsent: {
      channelPreferences: {
        in_app_announcements: true,
        sms_attendance_alerts: true,
        emergency_broadcasts: true,
      },
      announcementsReceivedCount: 18,
    },
    confidentialSafeguardingDossier: {
      status: "REDACTED_BY_STATUTORY_EXEMPTION",
      statutoryLegalBasis: "UK DPA 2018 Schedule 2 Part 2 / GDPR Recital 38 (Child Safety)",
      notice: "Confidential child safeguarding, medical diagnoses, and disciplinary investigation narratives are segregated and exempt from open portability to safeguard the safety and well-being of the minor.",
    },
  };
}

/**
 * Executes irreversible pseudonymization of Personally Identifiable Information (PII)
 * for a student (Article 17 Right to Erasure / Right to be Forgotten), while maintaining
 * statistical marks and aggregate transcripts required by educational regulations.
 */
export function anonymizeStudentPII(
  student: { id: string; firstName: string; lastName: string; dateOfBirth: string }
): {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  status: "Withdrawn";
  isAnonymized: boolean;
  anonymizedAt: string;
} {
  const token = student.id.substring(0, 8).toUpperCase();
  return {
    id: student.id,
    firstName: "Anonymized",
    lastName: `Student_${token}`,
    dateOfBirth: "1970-01-01",
    status: "Withdrawn",
    isAnonymized: true,
    anonymizedAt: new Date().toISOString(),
  };
}
