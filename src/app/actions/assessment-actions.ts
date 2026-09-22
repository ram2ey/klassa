"use server";

import { requireDemoAction } from "@/lib/action-access";

import { logAuditEvent, AuditActions } from "@/lib/audit";
import { addInAppNotification } from "@/lib/notifications";
import {
  type AssessmentInput,
  type AssessmentStatus,
  type GradingScaleEntry,
  type GradingSchemeType,
  type OfficialReportCardData,
  calculateGradingProgress,
  calculateWeightedTermGrade,
  gradeCorrectionSchema,
  scoreToGrade,
  STANDARD_LETTER_SCALE,
  STANDARDS_BASED_SCALE,
} from "@/lib/assessments";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

export interface AssessmentCategoryItem {
  id: string;
  name: string;
  weight: number;
  subjectId?: string;
}

export interface AssessmentItemData {
  id: string;
  title: string;
  code: string;
  classId: string;
  subjectId: string;
  categoryId: string;
  categoryName: string;
  termId: string;
  maxScore: number;
  dateDue: string;
  status: AssessmentStatus;
  createdById?: string;
  createdAt: string;
}

export interface StudentGradeEntry {
  id: string;
  assessmentId: string;
  studentId: string;
  score: number;
  percentage: number;
  letterGrade: string;
  status: "draft" | "submitted" | "published";
  feedback?: string;
  gradedBy: string;
  gradedAt: string;
}

export interface GradebookStudentRow {
  studentId: string;
  studentNumber: string;
  studentName: string;
  className: string;
  scores: Record<string, {
    gradeId: string;
    score: number;
    percentage: number;
    letterGrade: string;
    status: "draft" | "published";
    feedback?: string;
  }>;
  computedPercentage: number;
  computedLetter: string;
  computedGpa: number;
}

export interface GradeCorrectionLogItem {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  studentId: string;
  studentName: string;
  previousScore: number;
  newScore: number;
  previousGrade: string;
  newGrade: string;
  reason: string;
  correctedBy: string;
  correctedAt: string;
}

export interface GradingSchemeDefinition {
  id: string;
  name: string;
  type: GradingSchemeType;
  scale: GradingScaleEntry[];
  isDefault: boolean;
}

// -------------------------------------------------------------
// Seed and Fallback State for Phase 3 Assessments
// -------------------------------------------------------------

const localGradingSchemes: GradingSchemeDefinition[] = [
  {
    id: "sch-letter",
    name: "Standard Letter Grade (A+ through F, 4.0 Scale)",
    type: "letter",
    scale: STANDARD_LETTER_SCALE,
    isDefault: true,
  },
  {
    id: "sch-standards",
    name: "Standards-Based Rubric (4-Level Proficiency)",
    type: "standards_based",
    scale: STANDARDS_BASED_SCALE,
    isDefault: false,
  },
];

const localCategories: AssessmentCategoryItem[] = [
  { id: "cat-quiz", name: "Formative Quizzes", weight: 20 },
  { id: "cat-hw", name: "Homework & Lab Work", weight: 20 },
  { id: "cat-mid", name: "Midterm Assessment", weight: 30 },
  { id: "cat-proj", name: "Final Project & Exam", weight: 30 },
];

const localAssessments: AssessmentItemData[] = [
  {
    id: "asm-mat-01",
    title: "Linear Equations & Functions Quiz",
    code: "MATH-Q1",
    classId: "cls-7b",
    subjectId: "sub-mat",
    categoryId: "cat-quiz",
    categoryName: "Formative Quizzes",
    termId: "term-fall-2026",
    maxScore: 100,
    dateDue: "2026-09-15",
    status: "published",
    createdAt: "10 Sep 2026",
  },
  {
    id: "asm-mat-02",
    title: "Algebraic Problem Set #1",
    code: "MATH-HW1",
    classId: "cls-7b",
    subjectId: "sub-mat",
    categoryId: "cat-hw",
    categoryName: "Homework & Lab Work",
    termId: "term-fall-2026",
    maxScore: 50,
    dateDue: "2026-09-18",
    status: "published",
    createdAt: "14 Sep 2026",
  },
  {
    id: "asm-mat-03",
    title: "Midterm Examination: Algebra & Logic",
    code: "MATH-MID",
    classId: "cls-7b",
    subjectId: "sub-mat",
    categoryId: "cat-mid",
    categoryName: "Midterm Assessment",
    termId: "term-fall-2026",
    maxScore: 100,
    dateDue: "2026-09-21",
    status: "published",
    createdAt: "18 Sep 2026",
  },
  {
    id: "asm-mat-04",
    title: "Applied Geometry & Statistics Project",
    code: "MATH-PRJ",
    classId: "cls-7b",
    subjectId: "sub-mat",
    categoryId: "cat-proj",
    categoryName: "Final Project & Exam",
    termId: "term-fall-2026",
    maxScore: 100,
    dateDue: "2026-09-28",
    status: "draft",
    createdAt: "Yesterday",
  },
  // Science assessments
  {
    id: "asm-sci-01",
    title: "Ecosystems & Energy Transfer Quiz",
    code: "SCI-Q1",
    classId: "cls-7b",
    subjectId: "sub-sci",
    categoryId: "cat-quiz",
    categoryName: "Formative Quizzes",
    termId: "term-fall-2026",
    maxScore: 100,
    dateDue: "2026-09-14",
    status: "published",
    createdAt: "10 Sep 2026",
  },
  {
    id: "asm-sci-02",
    title: "Cellular Biology Lab Report",
    code: "SCI-LAB1",
    classId: "cls-7b",
    subjectId: "sub-sci",
    categoryId: "cat-hw",
    categoryName: "Homework & Lab Work",
    termId: "term-fall-2026",
    maxScore: 100,
    dateDue: "2026-09-19",
    status: "published",
    createdAt: "15 Sep 2026",
  },
];

const localGrades: StudentGradeEntry[] = [
  // Amelia Warren (ST-2026-0142) - Math
  { id: "grd-01", assessmentId: "asm-mat-01", studentId: "ST-2026-0142", score: 94, percentage: 94, letterGrade: "A", status: "published", feedback: "Strong step-by-step logic", gradedBy: "Elena Rostova", gradedAt: "16 Sep 2026" },
  { id: "grd-02", assessmentId: "asm-mat-02", studentId: "ST-2026-0142", score: 48, percentage: 96, letterGrade: "A", status: "published", feedback: "Accurate problem sets", gradedBy: "Elena Rostova", gradedAt: "19 Sep 2026" },
  { id: "grd-03", assessmentId: "asm-mat-03", studentId: "ST-2026-0142", score: 92, percentage: 92, letterGrade: "A-", status: "published", feedback: "Excellent performance", gradedBy: "Elena Rostova", gradedAt: "21 Sep 2026" },
  { id: "grd-04", assessmentId: "asm-mat-04", studentId: "ST-2026-0142", score: 95, percentage: 95, letterGrade: "A", status: "draft", feedback: "Draft rubric assessment", gradedBy: "Elena Rostova", gradedAt: "Today, 08:30" },

  // Leo Williams (ST-2026-0115) - Math
  { id: "grd-05", assessmentId: "asm-mat-01", studentId: "ST-2026-0115", score: 85, percentage: 85, letterGrade: "B", status: "published", feedback: "Solid work", gradedBy: "Elena Rostova", gradedAt: "16 Sep 2026" },
  { id: "grd-06", assessmentId: "asm-mat-02", studentId: "ST-2026-0115", score: 40, percentage: 80, letterGrade: "B-", status: "published", feedback: "Review fraction simplification", gradedBy: "Elena Rostova", gradedAt: "19 Sep 2026" },
  { id: "grd-07", assessmentId: "asm-mat-03", studentId: "ST-2026-0115", score: 88, percentage: 88, letterGrade: "B+", status: "published", feedback: "Good effort", gradedBy: "Elena Rostova", gradedAt: "21 Sep 2026" },

  // Sofia Larsen (ST-2026-0119) - Math
  { id: "grd-08", assessmentId: "asm-mat-01", studentId: "ST-2026-0119", score: 98, percentage: 98, letterGrade: "A+", status: "published", feedback: "Flawless demonstration", gradedBy: "Elena Rostova", gradedAt: "16 Sep 2026" },
  { id: "grd-09", assessmentId: "asm-mat-02", studentId: "ST-2026-0119", score: 50, percentage: 100, letterGrade: "A+", status: "published", feedback: "Perfect homework", gradedBy: "Elena Rostova", gradedAt: "19 Sep 2026" },
  { id: "grd-10", assessmentId: "asm-mat-03", studentId: "ST-2026-0119", score: 96, percentage: 96, letterGrade: "A", status: "published", feedback: "Exceptional midterm exam", gradedBy: "Elena Rostova", gradedAt: "21 Sep 2026" },

  // Noah Bennett (ST-2026-0138) - Math
  { id: "grd-11", assessmentId: "asm-mat-01", studentId: "ST-2026-0138", score: 76, percentage: 76, letterGrade: "C", status: "published", feedback: "Needs practice with quadratics", gradedBy: "Elena Rostova", gradedAt: "16 Sep 2026" },
  { id: "grd-12", assessmentId: "asm-mat-02", studentId: "ST-2026-0138", score: 38, percentage: 76, letterGrade: "C", status: "published", feedback: "Incomplete working shown", gradedBy: "Elena Rostova", gradedAt: "19 Sep 2026" },
  { id: "grd-13", assessmentId: "asm-mat-03", studentId: "ST-2026-0138", score: 80, percentage: 80, letterGrade: "B-", status: "published", feedback: "Improved exam score", gradedBy: "Elena Rostova", gradedAt: "21 Sep 2026" },

  // Elias Martin (ST-2026-0126) - Math
  { id: "grd-14", assessmentId: "asm-mat-01", studentId: "ST-2026-0126", score: 72, percentage: 72, letterGrade: "C-", status: "published", feedback: "Needs math tutoring support", gradedBy: "Elena Rostova", gradedAt: "16 Sep 2026" },
  { id: "grd-15", assessmentId: "asm-mat-02", studentId: "ST-2026-0126", score: 35, percentage: 70, letterGrade: "C-", status: "published", feedback: "Submitted late", gradedBy: "Elena Rostova", gradedAt: "19 Sep 2026" },

  // Science grades for Amelia Warren
  { id: "grd-16", assessmentId: "asm-sci-01", studentId: "ST-2026-0142", score: 96, percentage: 96, letterGrade: "A", status: "published", feedback: "Excellent grasp of ecological cycles", gradedBy: "Mark Davies", gradedAt: "15 Sep 2026" },
  { id: "grd-17", assessmentId: "asm-sci-02", studentId: "ST-2026-0142", score: 94, percentage: 94, letterGrade: "A", status: "published", feedback: "Comprehensive microscopic analysis", gradedBy: "Mark Davies", gradedAt: "20 Sep 2026" },
];

const localCorrections: GradeCorrectionLogItem[] = [
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

const localReportCards: OfficialReportCardData[] = [
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
      {
        subjectCode: "MATH-01",
        subjectName: "Mathematics & Logic",
        department: "STEM",
        teacherName: "Elena Rostova",
        scorePercentage: 93.0,
        letterGrade: "A",
        gpaPoint: 4.0,
        standardsLevel: "4 - Exceeding",
        teacherComments: "Amelia demonstrates outstanding logical clarity and participates actively in problem-solving discussions.",
      },
      {
        subjectCode: "SCI-01",
        subjectName: "Natural Sciences",
        department: "STEM",
        teacherName: "Mark Davies",
        scorePercentage: 95.0,
        letterGrade: "A",
        gpaPoint: 4.0,
        standardsLevel: "4 - Exceeding",
        teacherComments: "Exceptional lab inquiry skills and analytical writing. A pleasure to teach.",
      },
      {
        subjectCode: "ENG-01",
        subjectName: "English Language Arts",
        department: "Humanities",
        teacherName: "Sarah Jenkins",
        scorePercentage: 91.5,
        letterGrade: "A-",
        gpaPoint: 3.7,
        standardsLevel: "3 - Meeting",
        teacherComments: "Insightful textual analysis in literature seminar. Keep developing essay thesis depth.",
      },
      {
        subjectCode: "HIS-01",
        subjectName: "World History & Civics",
        department: "Humanities",
        teacherName: "Thomas Brown",
        scorePercentage: 94.0,
        letterGrade: "A",
        gpaPoint: 4.0,
        standardsLevel: "4 - Exceeding",
        teacherComments: "Thorough understanding of historical evidence and cause-and-effect civil analysis.",
      },
      {
        subjectCode: "ART-01",
        subjectName: "Visual Arts & Design",
        department: "Creative Arts",
        teacherName: "Ingrid Holm",
        scorePercentage: 96.0,
        letterGrade: "A",
        gpaPoint: 4.0,
        standardsLevel: "4 - Exceeding",
        teacherComments: "Superb portfolio quality, demonstrating thoughtful craftsmanship and balance.",
      },
      {
        subjectCode: "PE-01",
        subjectName: "Physical Education & Health",
        department: "Athletics",
        teacherName: "James Miller",
        scorePercentage: 93.5,
        letterGrade: "A",
        gpaPoint: 4.0,
        standardsLevel: "4 - Exceeding",
        teacherComments: "Positive leadership during team athletics and consistent commitment.",
      },
    ],
    homeroomTeacherRemarks: "Amelia has had an exemplary term both academically and socially. She consistently supports her peers and exemplifies the school's core institutional values.",
    principalRemarks: "Distinguished Academic Honor Roll. Congratulations on an exceptional first term.",
    publishedAt: "22 Sep 2026",
  },
];

// -------------------------------------------------------------
// Server Actions
// -------------------------------------------------------------

export async function getAssessmentsAndGradebookAction(params: {
  classId: string;
  subjectId: string;
}) {
  await requireDemoAction();
  const filteredAssessments = localAssessments.filter(
    (a) => a.classId === params.classId && a.subjectId === params.subjectId,
  );

  const studentDirectory = [
    { id: "ST-2026-0142", studentNumber: "ST-2026-0142", studentName: "Amelia Warren", className: "7B" },
    { id: "ST-2026-0115", studentNumber: "ST-2026-0115", studentName: "Leo Williams", className: "7B" },
    { id: "ST-2026-0119", studentNumber: "ST-2026-0119", studentName: "Sofia Larsen", className: "7B" },
    { id: "ST-2026-0138", studentNumber: "ST-2026-0138", studentName: "Noah Bennett", className: "7B" },
    { id: "ST-2026-0126", studentNumber: "ST-2026-0126", studentName: "Elias Martin", className: "7B" },
  ];

  const assessmentIds = new Set(filteredAssessments.map((a) => a.id));
  const relevantGrades = localGrades.filter((g) => assessmentIds.has(g.assessmentId));

  const rows: GradebookStudentRow[] = studentDirectory.map((st) => {
    const studentGrades = relevantGrades.filter((g) => g.studentId === st.id);
    const scoreMap: GradebookStudentRow["scores"] = {};

    studentGrades.forEach((g) => {
      scoreMap[g.assessmentId] = {
        gradeId: g.id,
        score: g.score,
        percentage: g.percentage,
        letterGrade: g.letterGrade,
        status: g.status === "draft" ? "draft" : "published",
        feedback: g.feedback,
      };
    });

    const weightedResult = calculateWeightedTermGrade(
      localCategories,
      filteredAssessments,
      studentGrades.map((g) => ({ assessmentId: g.assessmentId, score: g.score })),
    );

    return {
      studentId: st.id,
      studentNumber: st.studentNumber,
      studentName: st.studentName,
      className: st.className,
      scores: scoreMap,
      computedPercentage: weightedResult.percentage,
      computedLetter: weightedResult.letterGrade,
      computedGpa: weightedResult.gpaPoint,
    };
  });

  const publishedCount = filteredAssessments.filter((a) => a.status === "published").length;
  const progress = calculateGradingProgress(
    studentDirectory.length,
    filteredAssessments.length,
    relevantGrades.length,
    publishedCount,
  );

  return {
    assessments: filteredAssessments,
    categories: localCategories,
    schemes: localGradingSchemes,
    students: rows,
    corrections: localCorrections,
    reportCards: localReportCards,
    progress,
  };
}

export async function saveGradebookScoreAction(params: {
  assessmentId: string;
  studentId: string;
  score: number;
  status: "draft" | "published";
  feedback?: string;
  actorName: string;
}) {
  await requireDemoAction();
  const assessment = localAssessments.find((a) => a.id === params.assessmentId);
  if (!assessment) return { success: false, error: "Assessment not found" };

  const pct = Math.round((params.score / assessment.maxScore) * 1000) / 10;
  const gradeInfo = scoreToGrade(pct);

  const existingIdx = localGrades.findIndex(
    (g) => g.assessmentId === params.assessmentId && g.studentId === params.studentId,
  );

  if (existingIdx >= 0) {
    localGrades[existingIdx] = {
      ...localGrades[existingIdx],
      score: params.score,
      percentage: pct,
      letterGrade: gradeInfo.label,
      status: params.status,
      feedback: params.feedback ?? localGrades[existingIdx].feedback,
      gradedBy: params.actorName,
      gradedAt: "Just now",
    };
  } else {
    localGrades.push({
      id: `grd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      assessmentId: params.assessmentId,
      studentId: params.studentId,
      score: params.score,
      percentage: pct,
      letterGrade: gradeInfo.label,
      status: params.status,
      feedback: params.feedback,
      gradedBy: params.actorName,
      gradedAt: "Just now",
    });
  }

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: params.actorName,
    action: AuditActions.GRADE_RECORDED,
    entityType: "assessment_grade",
    entityId: `${params.assessmentId}:${params.studentId}`,
    metadata: {
      assessment: assessment.title,
      score: params.score,
      letterGrade: gradeInfo.label,
      status: params.status,
    },
  });

  return { success: true };
}

export async function correctGradeWithAuditAction(params: {
  gradeId: string;
  assessmentId: string;
  studentId: string;
  studentName: string;
  previousScore: number;
  newScore: number;
  reason: string;
  actorName: string;
}) {
  await requireDemoAction();
  const validation = gradeCorrectionSchema.safeParse({
    assessmentGradeId: params.gradeId,
    studentId: params.studentId,
    previousScore: params.previousScore,
    newScore: params.newScore,
    reason: params.reason,
    correctedBy: params.actorName,
  });

  if (!validation.success) {
    return { success: false, error: validation.error.issues[0]?.message || "Invalid correction" };
  }

  const assessment = localAssessments.find((a) => a.id === params.assessmentId);
  const maxScore = assessment?.maxScore ?? 100;
  const prevPct = Math.round((params.previousScore / maxScore) * 100);
  const newPct = Math.round((params.newScore / maxScore) * 100);
  const prevGrade = scoreToGrade(prevPct).label;
  const newGrade = scoreToGrade(newPct).label;

  const targetGrade = localGrades.find((g) => g.id === params.gradeId);
  if (targetGrade) {
    targetGrade.score = params.newScore;
    targetGrade.percentage = newPct;
    targetGrade.letterGrade = newGrade;
    targetGrade.gradedBy = params.actorName;
    targetGrade.gradedAt = "Just now";
  }

  const correctionRecord: GradeCorrectionLogItem = {
    id: `gcorr-${Date.now()}`,
    assessmentId: params.assessmentId,
    assessmentTitle: assessment?.title ?? "Assessment",
    studentId: params.studentId,
    studentName: params.studentName,
    previousScore: params.previousScore,
    newScore: params.newScore,
    previousGrade: prevGrade,
    newGrade: newGrade,
    reason: params.reason,
    correctedBy: params.actorName,
    correctedAt: "Just now",
  };
  localCorrections.unshift(correctionRecord);

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: params.actorName,
    action: AuditActions.GRADE_CORRECTED,
    entityType: "grade_correction",
    entityId: params.gradeId,
    metadata: {
      studentName: params.studentName,
      assessment: assessment?.title,
      from: `${params.previousScore} (${prevGrade})`,
      to: `${params.newScore} (${newGrade})`,
      reason: params.reason,
    },
  });

  return { success: true, correction: correctionRecord };
}

export async function toggleAssessmentPublicationAction(
  assessmentId: string,
  publish: boolean,
  actorName: string,
) {
  await requireDemoAction();
  const assessment = localAssessments.find((a) => a.id === assessmentId);
  if (!assessment) return { success: false, error: "Assessment not found" };

  const newStatus: AssessmentStatus = publish ? "published" : "draft";
  assessment.status = newStatus;

  // Also update existing student grades status to match
  localGrades.forEach((g) => {
    if (g.assessmentId === assessmentId) {
      g.status = newStatus;
    }
  });

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: actorName,
    action: publish ? AuditActions.ASSESSMENT_PUBLISHED : "assessment.unpublished",
    entityType: "assessment",
    entityId: assessmentId,
    metadata: {
      assessment: assessment.title,
      status: newStatus,
    },
  });

  if (publish) {
    addInAppNotification({
      title: "Assessment Grades Published",
      message: `${assessment.title} (${assessment.code}) grades published. Guardians can now review results in the portal.`,
      type: "grade_updated",
      metadata: { assessmentId, title: assessment.title },
    });
  }

  return { success: true, status: newStatus };
}

export async function createAssessmentAction(
  input: AssessmentInput,
  actorName: string,
) {
  await requireDemoAction();
  const cat = localCategories.find((c) => c.id === input.categoryId);
  const newAssessment: AssessmentItemData = {
    id: `asm-${input.code.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString().slice(-4)}`,
    title: input.title,
    code: input.code,
    classId: input.classId,
    subjectId: input.subjectId,
    categoryId: input.categoryId,
    categoryName: cat?.name ?? "General",
    termId: input.termId,
    maxScore: input.maxScore,
    dateDue: input.dateDue,
    status: input.status,
    createdById: actorName,
    createdAt: "Just now",
  };

  localAssessments.push(newAssessment);

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: actorName,
    action: AuditActions.ASSESSMENT_CREATED,
    entityType: "assessment",
    entityId: newAssessment.id,
    metadata: { title: input.title, code: input.code, category: cat?.name },
  });

  return { success: true, assessment: newAssessment };
}

export async function publishReportCardAction(
  reportCardId: string,
  actorName: string,
) {
  await requireDemoAction();
  const rc = localReportCards.find((r) => r.reportCardId === reportCardId);
  if (!rc) return { success: false, error: "Report card not found" };

  rc.status = "published";
  rc.publishedAt = "Today";

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: actorName,
    action: AuditActions.REPORT_CARD_PUBLISHED,
    entityType: "report_card",
    entityId: reportCardId,
    metadata: {
      studentName: rc.studentName,
      term: rc.termName,
      version: `v${rc.version}.0`,
      gpa: rc.gpa,
    },
  });

  addInAppNotification({
    title: "Official Term Report Card Published",
    message: `Official Report Card (${rc.termName}) published for ${rc.studentName}. Available for guardian download.`,
    type: "report_card_published",
    metadata: { reportCardId, studentId: rc.studentId },
  });

  return { success: true, reportCard: rc };
}

export async function generateTermReportCardsAction(
  termId: string,
  classId: string,
  actorName: string,
) {
  await requireDemoAction();
  // Batch generate or update for students in class
  const classStudents = [
    { id: "ST-2026-0142", studentNumber: "ST-2026-0142", studentName: "Amelia Warren", gradeLevel: "Grade 7", className: "7B" },
    { id: "ST-2026-0115", studentNumber: "ST-2026-0115", studentName: "Leo Williams", gradeLevel: "Grade 6", className: "7B" },
    { id: "ST-2026-0119", studentNumber: "ST-2026-0119", studentName: "Sofia Larsen", gradeLevel: "Grade 7", className: "7B" },
  ];

  for (const st of classStudents) {
    const existing = localReportCards.find((rc) => rc.studentId === st.id && rc.termName.includes("Term 1"));
    if (!existing) {
      const newCard: OfficialReportCardData = {
        reportCardId: `rc-${st.id.toLowerCase()}-t1`,
        studentId: st.id,
        studentNumber: st.studentNumber,
        studentName: st.studentName,
        gradeLevel: st.gradeLevel,
        className: st.className,
        academicYear: "2026–2027",
        termName: "Term 1 (Fall)",
        version: 1,
        status: "draft",
        gpa: 3.65,
        overallPercentage: 90.2,
        attendance: {
          attendanceRate: 96.0,
          daysEnrolled: 45,
          daysPresent: 43,
          daysLate: 1,
          daysExcused: 1,
          daysAbsent: 0,
        },
        subjects: [
          {
            subjectCode: "MATH-01",
            subjectName: "Mathematics & Logic",
            department: "STEM",
            teacherName: "Elena Rostova",
            scorePercentage: 90.0,
            letterGrade: "A-",
            gpaPoint: 3.7,
            teacherComments: "Consistent engagement and reliable problem-solving competence.",
          },
          {
            subjectCode: "SCI-01",
            subjectName: "Natural Sciences",
            department: "STEM",
            teacherName: "Mark Davies",
            scorePercentage: 91.0,
            letterGrade: "A-",
            gpaPoint: 3.7,
            teacherComments: "Good application during laboratory experiments.",
          },
        ],
        homeroomTeacherRemarks: "Demonstrated strong focus and cooperative teamwork across all disciplines.",
        principalRemarks: "Satisfactory academic achievement and positive school conduct.",
      };
      localReportCards.push(newCard);
    }
  }

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: actorName,
    action: AuditActions.REPORT_CARD_GENERATED,
    entityType: "report_card_batch",
    entityId: `batch-${classId}-${termId}`,
    metadata: { classId, count: classStudents.length },
  });

  return { success: true, count: classStudents.length, reportCards: localReportCards };
}

export async function getGuardianAcademicSummaryAction(studentId: string) {
  await requireDemoAction();
  const publishedReportCards = localReportCards.filter(
    (rc) => rc.studentId === studentId && rc.status === "published",
  );

  const publishedAssessments = localAssessments.filter((a) => a.status === "published");
  const publishedAssessmentIds = new Set(publishedAssessments.map((a) => a.id));

  const publishedGrades = localGrades.filter(
    (g) => g.studentId === studentId && g.status === "published" && publishedAssessmentIds.has(g.assessmentId),
  );

  return {
    reportCards: publishedReportCards,
    recentGrades: publishedGrades.map((g) => {
      const asm = publishedAssessments.find((a) => a.id === g.assessmentId);
      return {
        ...g,
        assessmentTitle: asm?.title ?? "Assessment",
        assessmentCode: asm?.code ?? "",
        categoryName: asm?.categoryName ?? "",
      };
    }),
  };
}
