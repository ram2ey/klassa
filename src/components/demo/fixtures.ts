"use client";
import { type AuditRecordItem } from "./types";
import { type AttendanceSheetRecord, type DiscrepancyCorrectionRecord } from "@/app/actions/attendance-actions";
import { type AssessmentItemData, type AssessmentCategoryItem, type GradingSchemeDefinition, type GradeCorrectionLogItem, type GradebookStudentRow } from "@/app/actions/assessment-actions";
import { STANDARD_LETTER_SCALE, STANDARDS_BASED_SCALE, type OfficialReportCardData } from "@/lib/assessments";

export const initialAuditLogs: AuditRecordItem[] = [
  { id: "aud-001", action: "student.updated", entityType: "student", entityId: "ST-2026-0142", actorUserId: "Olivia Parker", metadata: { target: "Amelia Warren", changes: "Guardian contact phone updated" }, createdAt: "12 min ago" },
  { id: "aud-002", action: "student.created", entityType: "student", entityId: "ST-2026-0126", actorUserId: "James Miller", metadata: { target: "Elias Martin", grade: "Grade 5" }, createdAt: "Yesterday, 15:34" },
  { id: "aud-003", action: "import.executed", entityType: "import_job", entityId: "imp-001", actorUserId: "Olivia Parker", metadata: { filename: "roster_fall_2026.csv", rowCount: 36 }, createdAt: "18 Sep, 11:06" },
  { id: "aud-004", action: "staff.invited", entityType: "invitation", entityId: "inv-001", actorUserId: "Olivia Parker", metadata: { email: "clara.counselor@northfield.edu", role: "office_staff" }, createdAt: "17 Sep, 16:45" },
];

export const initialRollCallRecords: AttendanceSheetRecord[] = [
  { recordId: "rec-01", studentId: "ST-2026-0142", studentNumber: "ST-2026-0142", studentName: "Amelia Warren", className: "7B", status: "present", arrivalMinutesLate: 0, guardianName: "David Warren", guardianPhone: "+354 555 0192" },
  { recordId: "rec-02", studentId: "ST-2026-0115", studentNumber: "ST-2026-0115", studentName: "Leo Williams", className: "7B", status: "late", arrivalMinutesLate: 15, reason: "School bus delay", remarks: "Bus #4 arrived 08:45", guardianName: "David Warren", guardianPhone: "+354 555 0192" },
  { recordId: "rec-03", studentId: "ST-2026-0119", studentNumber: "ST-2026-0119", studentName: "Sofia Larsen", className: "7B", status: "present", arrivalMinutesLate: 0, guardianName: "Marta Larsen", guardianPhone: "+354 555 0177" },
  { recordId: "rec-04", studentId: "ST-2026-0138", studentNumber: "ST-2026-0138", studentName: "Noah Bennett", className: "7B", status: "excused", arrivalMinutesLate: 0, reason: "Dentist appointment", remarks: "Note verified", guardianName: "Karen Bennett", guardianPhone: "+354 555 0284" },
  { recordId: "rec-05", studentId: "ST-2026-0126", studentNumber: "ST-2026-0126", studentName: "Elias Martin", className: "7B", status: "absent", arrivalMinutesLate: 0, reason: "Unexcused absence", guardianName: "Robert Martin", guardianPhone: "+354 555 0371" },
];

export const initialCorrections: DiscrepancyCorrectionRecord[] = [
  {
    id: "corr-001",
    recordId: "rec-04",
    studentId: "ST-2026-0138",
    studentName: "Noah Bennett",
    className: "7B",
    date: "2026-09-22",
    previousStatus: "absent",
    newStatus: "excused",
    reason: "Parent phoned office at 09:10 to confirm dentist appointment; certificate received.",
    correctedBy: "Olivia Parker (Office Staff)",
    correctedAt: "Today, 09:15",
  },
];

export const initialAssessments: AssessmentItemData[] = [
  { id: "asm-mat-01", title: "Linear Equations & Functions Quiz", code: "MATH-Q1", classId: "cls-7b", subjectId: "sub-mat", categoryId: "cat-quiz", categoryName: "Formative Quizzes", termId: "term-fall-2026", maxScore: 100, dateDue: "2026-09-15", status: "published", createdAt: "10 Sep 2026" },
  { id: "asm-mat-02", title: "Algebraic Problem Set #1", code: "MATH-HW1", classId: "cls-7b", subjectId: "sub-mat", categoryId: "cat-hw", categoryName: "Homework & Lab Work", termId: "term-fall-2026", maxScore: 50, dateDue: "2026-09-18", status: "published", createdAt: "14 Sep 2026" },
  { id: "asm-mat-03", title: "Midterm Examination: Algebra & Logic", code: "MATH-MID", classId: "cls-7b", subjectId: "sub-mat", categoryId: "cat-mid", categoryName: "Midterm Assessment", termId: "term-fall-2026", maxScore: 100, dateDue: "2026-09-21", status: "published", createdAt: "18 Sep 2026" },
  { id: "asm-mat-04", title: "Applied Geometry & Statistics Project", code: "MATH-PRJ", classId: "cls-7b", subjectId: "sub-mat", categoryId: "cat-proj", categoryName: "Final Project & Exam", termId: "term-fall-2026", maxScore: 100, dateDue: "2026-09-28", status: "draft", createdAt: "Yesterday" },
];

export const initialAssessmentCategories: AssessmentCategoryItem[] = [
  { id: "cat-quiz", name: "Formative Quizzes", weight: 20 },
  { id: "cat-hw", name: "Homework & Lab Work", weight: 20 },
  { id: "cat-mid", name: "Midterm Assessment", weight: 30 },
  { id: "cat-proj", name: "Final Project & Exam", weight: 30 },
];

export const initialSchemes: GradingSchemeDefinition[] = [
  { id: "sch-letter", name: "Standard Letter Grade (A+ through F, 4.0 Scale)", type: "letter", scale: STANDARD_LETTER_SCALE, isDefault: true },
  { id: "sch-standards", name: "Standards-Based Rubric (4-Level Proficiency)", type: "standards_based", scale: STANDARDS_BASED_SCALE, isDefault: false },
];

export const initialGradeCorrections: GradeCorrectionLogItem[] = [
  {
    id: "gcorr-001",
    assessmentId: "asm-mat-03",
    assessmentTitle: "Midterm Examination: Algebra & Logic",
    studentId: "ST-2026-0142",
    studentName: "Amelia Warren",
    previousScore: 88,
    newScore: 92,
    previousGrade: "B+",
    newGrade: "A-",
    reason: "Correction on question 14: geometric proof verified during teacher department review.",
    correctedBy: "Elena Rostova (Teacher)",
    correctedAt: "21 Sep 2026, 16:40",
  },
];

export const initialGradebookStudents: GradebookStudentRow[] = [
  {
    studentId: "ST-2026-0142",
    studentNumber: "ST-2026-0142",
    studentName: "Amelia Warren",
    className: "7B",
    scores: {
      "asm-mat-01": { gradeId: "grd-01", score: 94, percentage: 94, letterGrade: "A", status: "published" },
      "asm-mat-02": { gradeId: "grd-02", score: 48, percentage: 96, letterGrade: "A", status: "published" },
      "asm-mat-03": { gradeId: "grd-03", score: 92, percentage: 92, letterGrade: "A-", status: "published" },
      "asm-mat-04": { gradeId: "grd-04", score: 95, percentage: 95, letterGrade: "A", status: "draft" },
    },
    computedPercentage: 93.7,
    computedLetter: "A",
    computedGpa: 4.0,
  },
  {
    studentId: "ST-2026-0115",
    studentNumber: "ST-2026-0115",
    studentName: "Leo Williams",
    className: "7B",
    scores: {
      "asm-mat-01": { gradeId: "grd-05", score: 85, percentage: 85, letterGrade: "B", status: "published" },
      "asm-mat-02": { gradeId: "grd-06", score: 40, percentage: 80, letterGrade: "B-", status: "published" },
      "asm-mat-03": { gradeId: "grd-07", score: 88, percentage: 88, letterGrade: "B+", status: "published" },
    },
    computedPercentage: 84.9,
    computedLetter: "B",
    computedGpa: 3.0,
  },
  {
    studentId: "ST-2026-0119",
    studentNumber: "ST-2026-0119",
    studentName: "Sofia Larsen",
    className: "7B",
    scores: {
      "asm-mat-01": { gradeId: "grd-08", score: 98, percentage: 98, letterGrade: "A+", status: "published" },
      "asm-mat-02": { gradeId: "grd-09", score: 50, percentage: 100, letterGrade: "A+", status: "published" },
      "asm-mat-03": { gradeId: "grd-10", score: 96, percentage: 96, letterGrade: "A", status: "published" },
    },
    computedPercentage: 97.7,
    computedLetter: "A+",
    computedGpa: 4.0,
  },
  {
    studentId: "ST-2026-0138",
    studentNumber: "ST-2026-0138",
    studentName: "Noah Bennett",
    className: "7B",
    scores: {
      "asm-mat-01": { gradeId: "grd-11", score: 76, percentage: 76, letterGrade: "C", status: "published" },
      "asm-mat-02": { gradeId: "grd-12", score: 38, percentage: 76, letterGrade: "C", status: "published" },
      "asm-mat-03": { gradeId: "grd-13", score: 80, percentage: 80, letterGrade: "B-", status: "published" },
    },
    computedPercentage: 77.7,
    computedLetter: "C+",
    computedGpa: 2.3,
  },
  {
    studentId: "ST-2026-0126",
    studentNumber: "ST-2026-0126",
    studentName: "Elias Martin",
    className: "7B",
    scores: {
      "asm-mat-01": { gradeId: "grd-14", score: 72, percentage: 72, letterGrade: "C-", status: "published" },
      "asm-mat-02": { gradeId: "grd-15", score: 35, percentage: 70, letterGrade: "C-", status: "published" },
    },
    computedPercentage: 71.0,
    computedLetter: "C-",
    computedGpa: 1.7,
  },
];

export const initialReportCards: OfficialReportCardData[] = [
  {
    reportCardId: "rc-st-0142-t1",
    studentId: "ST-2026-0142",
    studentNumber: "ST-2026-0142",
    studentName: "Amelia Warren",
    gradeLevel: "Grade 7",
    className: "7B",
    academicYear: "2026–2027",
    termName: "Term 1 (Fall)",
    version: 1,
    status: "published",
    gpa: 3.85,
    overallPercentage: 93.8,
    attendance: {
      attendanceRate: 97.8,
      daysEnrolled: 45,
      daysPresent: 44,
      daysLate: 0,
      daysExcused: 1,
      daysAbsent: 0,
    },
    subjects: [
      { subjectCode: "MATH-01", subjectName: "Mathematics & Logic", department: "STEM", teacherName: "Elena Rostova", scorePercentage: 93.0, letterGrade: "A", gpaPoint: 4.0, standardsLevel: "4 - Exceeding", teacherComments: "Amelia demonstrates outstanding logical clarity and participates actively in problem-solving discussions." },
      { subjectCode: "SCI-01", subjectName: "Natural Sciences", department: "STEM", teacherName: "Mark Davies", scorePercentage: 95.0, letterGrade: "A", gpaPoint: 4.0, standardsLevel: "4 - Exceeding", teacherComments: "Exceptional lab inquiry skills and analytical writing. A pleasure to teach." },
      { subjectCode: "ENG-01", subjectName: "English Language Arts", department: "Humanities", teacherName: "Sarah Jenkins", scorePercentage: 91.5, letterGrade: "A-", gpaPoint: 3.7, standardsLevel: "3 - Meeting", teacherComments: "Insightful textual analysis in literature seminar. Keep developing essay thesis depth." },
      { subjectCode: "HIS-01", subjectName: "World History & Civics", department: "Humanities", teacherName: "Thomas Brown", scorePercentage: 94.0, letterGrade: "A", gpaPoint: 4.0, standardsLevel: "4 - Exceeding", teacherComments: "Thorough understanding of historical evidence and cause-and-effect civil analysis." },
      { subjectCode: "ART-01", subjectName: "Visual Arts & Design", department: "Creative Arts", teacherName: "Ingrid Holm", scorePercentage: 96.0, letterGrade: "A", gpaPoint: 4.0, standardsLevel: "4 - Exceeding", teacherComments: "Superb portfolio quality, demonstrating thoughtful craftsmanship and balance." },
      { subjectCode: "PE-01", subjectName: "Physical Education & Health", department: "Athletics", teacherName: "James Miller", scorePercentage: 93.5, letterGrade: "A", gpaPoint: 4.0, standardsLevel: "4 - Exceeding", teacherComments: "Positive leadership during team athletics and consistent commitment." },
    ],
    homeroomTeacherRemarks: "Amelia has had an exemplary term both academically and socially. She consistently supports her peers and exemplifies the school's core institutional values.",
    principalRemarks: "Distinguished Academic Honor Roll. Congratulations on an exceptional first term.",
    publishedAt: "22 Sep 2026",
  },
  {
    reportCardId: "rc-st-0115-t1",
    studentId: "ST-2026-0115",
    studentNumber: "ST-2026-0115",
    studentName: "Leo Williams",
    gradeLevel: "Grade 6",
    className: "7B",
    academicYear: "2026–2027",
    termName: "Term 1 (Fall)",
    version: 1,
    status: "draft",
    gpa: 3.20,
    overallPercentage: 84.5,
    attendance: {
      attendanceRate: 95.5,
      daysEnrolled: 45,
      daysPresent: 43,
      daysLate: 1,
      daysExcused: 0,
      daysAbsent: 1,
    },
    subjects: [
      { subjectCode: "MATH-01", subjectName: "Mathematics & Logic", department: "STEM", teacherName: "Elena Rostova", scorePercentage: 85.0, letterGrade: "B", gpaPoint: 3.0, teacherComments: "Solid engagement; focus on foundational algebra." },
      { subjectCode: "SCI-01", subjectName: "Natural Sciences", department: "STEM", teacherName: "Mark Davies", scorePercentage: 84.0, letterGrade: "B", gpaPoint: 3.0, teacherComments: "Good participation in laboratory demonstrations." },
    ],
    homeroomTeacherRemarks: "Leo is making steady progress and shows great sportsmanship.",
    principalRemarks: "Good academic standing.",
  },
];
