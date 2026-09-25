"use server";
import { isDemoMode } from "@/lib/runtime-config";
import { createLiveStudent, updateLiveStudentStatus } from "@/lib/live-roster";
import { z } from "zod";
import { phoneNumberSchema } from "@/lib/phone";

import { requireDemoAction } from "@/lib/action-access";

import { AuditActions, logAuditEvent } from "@/lib/audit";
import { validateStudentCsv } from "@/lib/csv";
import { studentInputSchema, type StudentInput } from "@/lib/validation/student";
import { SCHOOL_TIME_ZONE } from "@/lib/timezone";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_USER_ID = "usr-admin-olivia";

// Fallback seed stores for demo/local evaluation
let localStudents = [
  { id: "ST-2026-0142", firstName: "Amelia", lastName: "Warren", initials: "AW", grade: "Grade 7", className: "7B", guardians: 2, status: "Active" as const, updated: "Today, 09:42", dateOfBirth: "2014-05-12" },
  { id: "ST-2026-0138", firstName: "Noah", lastName: "Bennett", initials: "NB", grade: "Grade 6", className: "6A", guardians: 1, status: "Active" as const, updated: "Today, 09:18", dateOfBirth: "2015-08-20" },
  { id: "ST-2026-0131", firstName: "Maya", lastName: "Thompson", initials: "MT", grade: "Grade 8", className: "8C", guardians: 2, status: "Active" as const, updated: "Yesterday", dateOfBirth: "2013-11-04" },
  { id: "ST-2026-0126", firstName: "Elias", lastName: "Martin", initials: "EM", grade: "Grade 5", className: "5A", guardians: 2, status: "Pending" as const, updated: "18 Sep 2026", dateOfBirth: "2016-02-14" },
  { id: "ST-2026-0119", firstName: "Sofia", lastName: "Larsen", initials: "SL", grade: "Grade 7", className: "7A", guardians: 1, status: "Active" as const, updated: "18 Sep 2026", dateOfBirth: "2014-07-29" },
  { id: "ST-2026-0115", firstName: "Leo", lastName: "Williams", initials: "LW", grade: "Grade 6", className: "6B", guardians: 2, status: "Active" as const, updated: "17 Sep 2026", dateOfBirth: "2015-01-19" },
];

let localGuardians = [
  { id: "gd-101", firstName: "David", lastName: "Warren", email: "david.warren@example.com", phone: "+354 555 0192", studentName: "Amelia Warren", studentId: "ST-2026-0142", relationship: "Parent", isPrimary: true, hasLegalResponsibility: true },
  { id: "gd-102", firstName: "Sarah", lastName: "Warren", email: "sarah.warren@example.com", phone: "+354 555 0193", studentName: "Amelia Warren", studentId: "ST-2026-0142", relationship: "Parent", isPrimary: false, hasLegalResponsibility: true },
  { id: "gd-103", firstName: "Karen", lastName: "Bennett", email: "k.bennett@example.com", phone: "+354 555 0284", studentName: "Noah Bennett", studentId: "ST-2026-0138", relationship: "Mother", isPrimary: true, hasLegalResponsibility: true },
  { id: "gd-104", firstName: "Robert", lastName: "Martin", email: "robert.m@example.com", phone: "+354 555 0371", studentName: "Elias Martin", studentId: "ST-2026-0126", relationship: "Guardian", isPrimary: true, hasLegalResponsibility: true },
];

let localClasses = [
  { id: "cls-7b", name: "7B", grade: "Grade 7", homeroomTeacher: "James Miller", studentCount: 28 },
  { id: "cls-7a", name: "7A", grade: "Grade 7", homeroomTeacher: "Elena Rostova", studentCount: 27 },
  { id: "cls-6a", name: "6A", grade: "Grade 6", homeroomTeacher: "Mark Davies", studentCount: 26 },
  { id: "cls-6b", name: "6B", grade: "Grade 6", homeroomTeacher: "Sarah Jenkins", studentCount: 25 },
  { id: "cls-8c", name: "8C", grade: "Grade 8", homeroomTeacher: "Thomas Brown", studentCount: 29 },
  { id: "cls-5a", name: "5A", grade: "Grade 5", homeroomTeacher: "Ingrid Holm", studentCount: 24 },
];

let localSubjects = [
  { id: "sub-mat", code: "MATH-01", name: "Mathematics & Logic", department: "STEM" },
  { id: "sub-sci", code: "SCI-01", name: "Natural Sciences", department: "STEM" },
  { id: "sub-eng", code: "ENG-01", name: "English Language Arts", department: "Humanities" },
  { id: "sub-his", code: "HIS-01", name: "World History & Civics", department: "Humanities" },
  { id: "sub-art", code: "ART-01", name: "Visual Arts & Design", department: "Creative Arts" },
  { id: "sub-ped", code: "PE-01", name: "Physical Education & Health", department: "Athletics" },
];

let localImportJobs = [
  { id: "imp-001", sourceFilename: "roster_fall_2026.csv", rowCount: 36, validRowCount: 36, invalidRowCount: 0, status: "completed", createdAt: "18 Sep 2026, 11:06" },
  { id: "imp-002", sourceFilename: "grade7_supplementary.csv", rowCount: 14, validRowCount: 12, invalidRowCount: 2, status: "completed", createdAt: "15 Sep 2026, 14:20" },
];

const localStaff = [
  { id: "usr-admin-olivia", name: "Olivia Parker", email: "olivia.parker@northfield.edu", role: "school_admin", twoFactorEnabled: true, status: "Active" },
  { id: "usr-staff-james", name: "James Miller", email: "james.miller@northfield.edu", role: "office_staff", twoFactorEnabled: true, status: "Active" },
  { id: "usr-teach-elena", name: "Elena Rostova", email: "elena.rostova@northfield.edu", role: "teacher", twoFactorEnabled: false, status: "MFA Pending" },
];

let localInvitations = [
  { id: "inv-001", phoneNumber: "+3545550101", role: "office_staff", token: "demo-only", expiresAt: "48 hours", status: "Simulated" },
  { id: "inv-002", phoneNumber: "+3545550102", role: "school_admin", token: "demo-only", expiresAt: "48 hours", status: "Simulated" },
];

// --- Server Actions ---

export async function getWorkspaceData() {
  await requireDemoAction();
  return {
    students: localStudents,
    guardians: localGuardians,
    classes: localClasses,
    subjects: localSubjects,
    importJobs: localImportJobs,
    staff: localStaff,
    invitations: localInvitations,
  };
}

export async function createStudentAction(input: StudentInput) {
  if (!isDemoMode()) return createLiveStudent(input);
  const validated = studentInputSchema.parse(input);
  let nextDemoNumber = 1;
  while (localStudents.some(student => student.id === `ST-${String(nextDemoNumber).padStart(6, "0")}`)) nextDemoNumber++;
  const studentNumber = `ST-${String(nextDemoNumber).padStart(6, "0")}`;
  const fullName = `${validated.firstName} ${validated.lastName}`;
  const initials = `${validated.firstName[0]}${validated.lastName[0]}`.toUpperCase();

  const newRecord = {
    id: studentNumber,
    firstName: validated.firstName,
    lastName: validated.lastName,
    initials,
    grade: validated.gradeLevel,
    className: validated.className,
    guardians: 0,
    status: "Pending" as const,
    updated: "Just now",
    dateOfBirth: validated.dateOfBirth,
  };


  localStudents = [newRecord, ...localStudents];

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: DEFAULT_USER_ID,
    action: AuditActions.STUDENT_CREATED,
    entityType: "student",
    entityId: studentNumber,
    metadata: { name: fullName, grade: validated.gradeLevel, className: validated.className },
  });

  return { success: true, student: newRecord };
}

export async function updateStudentStatusAction(studentId: string, newStatus: "Active" | "Pending") {
  if (!isDemoMode()) return updateLiveStudentStatus(studentId, newStatus);
  z.enum(["Active", "Pending"]).parse(newStatus);
  if (!localStudents.some((student) => student.id === studentId)) throw new Error("Student not found.");
  localStudents = localStudents.map((s) => (s.id === studentId ? { ...s, status: newStatus, updated: "Just now" } : s));


  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: DEFAULT_USER_ID,
    action: AuditActions.STUDENT_STATUS_CHANGED,
    entityType: "student",
    entityId: studentId,
    metadata: { newStatus },
  });

  return { success: true };
}

export async function createGuardianAction(params: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  studentId: string;
  relationship: string;
  isPrimary: boolean;
  hasLegalResponsibility: boolean;
}) {
  await requireDemoAction();
  const student = localStudents.find((s) => s.id === params.studentId);
  const studentName = student ? `${student.firstName} ${student.lastName}` : params.studentId;

  const newGuardian = {
    id: `gd-${Date.now().toString().slice(-4)}`,
    firstName: params.firstName,
    lastName: params.lastName,
    email: params.email,
    phone: params.phone,
    studentId: params.studentId,
    studentName,
    relationship: params.relationship,
    isPrimary: params.isPrimary,
    hasLegalResponsibility: params.hasLegalResponsibility,
  };

  localGuardians = [newGuardian, ...localGuardians];
  if (student) {
    student.guardians += 1;
    student.updated = "Just now";
  }

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: DEFAULT_USER_ID,
    action: AuditActions.GUARDIAN_LINKED,
    entityType: "guardian",
    entityId: newGuardian.id,
    metadata: { guardianName: `${params.firstName} ${params.lastName}`, studentId: params.studentId, relationship: params.relationship },
  });

  return { success: true, guardian: newGuardian };
}

export async function processCsvImportAction(filename: string, csvContent: string) {
  await requireDemoAction();
  const validation = validateStudentCsv(csvContent);

  const importRecord = {
    id: `imp-${Date.now().toString().slice(-4)}`,
    sourceFilename: filename,
    rowCount: validation.totalRows,
    validRowCount: validation.validCount,
    invalidRowCount: validation.invalidCount,
    status: validation.isValid ? "completed" : "failed",
    createdAt: "Just now",
  };

  localImportJobs = [importRecord, ...localImportJobs];

  if (validation.validRecords.length > 0) {
    for (const record of validation.validRecords) {
        let nextDemoNumber = 1;
        while (localStudents.some(student => student.id === `ST-${String(nextDemoNumber).padStart(6, "0")}`)) nextDemoNumber++;
        const studentNumber = `ST-${String(nextDemoNumber).padStart(6, "0")}`;
        localStudents.push({
          id: studentNumber,
          firstName: record.firstName,
          lastName: record.lastName,
          initials: `${record.firstName[0]}${record.lastName[0]}`.toUpperCase(),
          grade: record.gradeLevel,
          className: record.className,
          guardians: 0,
          status: "Active",
          updated: "Imported today",
          dateOfBirth: record.dateOfBirth,
        });
    }
  }

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: DEFAULT_USER_ID,
    action: AuditActions.CSV_IMPORT_EXECUTED,
    entityType: "import_job",
    entityId: importRecord.id,
    metadata: {
      filename,
      total: validation.totalRows,
      valid: validation.validCount,
      invalid: validation.invalidCount,
    },
  });

  return {
    success: validation.validCount > 0,
    importJob: importRecord,
    validation,
  };
}

export async function inviteStaffAction(phone: string, role: "school_admin" | "office_staff") {
  await requireDemoAction();
  const phoneNumber = phoneNumberSchema.parse(phone);
  z.enum(["school_admin", "office_staff"]).parse(role);
  const token = crypto.randomUUID();
  const invitation = {
    id: `inv-${Date.now().toString().slice(-4)}`,
    phoneNumber,
    role,
    token,
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: SCHOOL_TIME_ZONE }),
    status: "Simulated",
  };

  localInvitations = [invitation, ...localInvitations];

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: DEFAULT_USER_ID,
    action: AuditActions.STAFF_INVITED,
    entityType: "invitation",
    entityId: invitation.id,
    metadata: { role, simulated: true },
  });

  return { success: true, invitation };
}

export async function createSubjectAction(code: string, name: string, department: string) {
  await requireDemoAction();
  const subject = {
    id: `sub-${Math.random().toString(36).substring(2, 6)}`,
    code: code.toUpperCase(),
    name,
    department,
  };
  localSubjects = [...localSubjects, subject];

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: DEFAULT_USER_ID,
    action: AuditActions.SUBJECT_CREATED,
    entityType: "subject",
    entityId: subject.id,
    metadata: { code, name },
  });

  return { success: true, subject };
}

export async function createClassAction(name: string, grade: string, homeroomTeacher: string) {
  await requireDemoAction();
  const newClass = {
    id: `cls-${Math.random().toString(36).substring(2, 6)}`,
    name,
    grade,
    homeroomTeacher,
    studentCount: 0,
  };
  localClasses = [...localClasses, newClass];

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: DEFAULT_USER_ID,
    action: AuditActions.CLASS_CREATED,
    entityType: "class",
    entityId: newClass.id,
    metadata: { name, grade, homeroomTeacher },
  });

  return { success: true, classRecord: newClass };
}
