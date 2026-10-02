export type NavModule = "Overview" | "Attendance" | "Gradebook" | "Report cards" | "Communications" | "Students" | "Guardians" | "Classes" | "Imports" | "Audit log" | "Settings";

export type Persona = "admin" | "teacher" | "guardian";

export interface StudentRecord {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  grade: string;
  className: string;
  guardians: number;
  status: "Active" | "Pending" | "Withdrawn";
  updated: string;
  dateOfBirth: string;
}

export interface GuardianRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  studentId: string;
  studentName: string;
  relationship: string;
  isPrimary: boolean;
  hasLegalResponsibility: boolean;
}

export interface ClassRecord {
  id: string;
  name: string;
  grade: string;
  homeroomTeacher: string;
  studentCount: number;
}

export interface SubjectRecord {
  id: string;
  code: string;
  name: string;
  department: string;
}

export interface ImportJobRecord {
  id: string;
  sourceFilename: string;
  rowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  status: string;
  createdAt: string;
}

export interface StaffRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  twoFactorEnabled: boolean;
  status: string;
}

export interface InvitationRecord {
  id: string;
  phoneNumber: string;
  role: string;
  token: string;
  expiresAt: string;
  status: string;
}

export interface AuditRecordItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}
