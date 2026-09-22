import { z } from "zod";

export type GradingSchemeType = "letter" | "percentage" | "standards_based";
export type AssessmentStatus = "draft" | "published";
export type GradeStatus = "draft" | "submitted" | "published";
export type ReportCardStatus = "draft" | "approved" | "published" | "archived";

export interface GradingScaleEntry {
  label: string;
  minScore: number;
  maxScore: number;
  gpaPoint: number;
  description?: string;
}

export const STANDARD_LETTER_SCALE: GradingScaleEntry[] = [
  { label: "A+", minScore: 97, maxScore: 100, gpaPoint: 4.0, description: "Exceptional mastery" },
  { label: "A", minScore: 93, maxScore: 96.99, gpaPoint: 4.0, description: "Excellent comprehension" },
  { label: "A-", minScore: 90, maxScore: 92.99, gpaPoint: 3.7, description: "Advanced achievement" },
  { label: "B+", minScore: 87, maxScore: 89.99, gpaPoint: 3.3, description: "Commendable progress" },
  { label: "B", minScore: 83, maxScore: 86.99, gpaPoint: 3.0, description: "Thorough understanding" },
  { label: "B-", minScore: 80, maxScore: 82.99, gpaPoint: 2.7, description: "Competent performance" },
  { label: "C+", minScore: 77, maxScore: 79.99, gpaPoint: 2.3, description: "Developing competence" },
  { label: "C", minScore: 73, maxScore: 76.99, gpaPoint: 2.0, description: "Satisfactory standard" },
  { label: "C-", minScore: 70, maxScore: 72.99, gpaPoint: 1.7, description: "Minimum passing standard" },
  { label: "D", minScore: 60, maxScore: 69.99, gpaPoint: 1.0, description: "Needs targeted support" },
  { label: "F", minScore: 0, maxScore: 59.99, gpaPoint: 0.0, description: "Incomplete / Insufficient evidence" },
];

export const STANDARDS_BASED_SCALE: GradingScaleEntry[] = [
  { label: "4 - Exceeding", minScore: 90, maxScore: 100, gpaPoint: 4.0, description: "Exceeds grade-level standards consistently" },
  { label: "3 - Meeting", minScore: 75, maxScore: 89.99, gpaPoint: 3.0, description: "Meets curriculum expectations independently" },
  { label: "2 - Approaching", minScore: 60, maxScore: 74.99, gpaPoint: 2.0, description: "Approaching standard with guided support" },
  { label: "1 - Emerging", minScore: 0, maxScore: 59.99, gpaPoint: 1.0, description: "Beginning to demonstrate foundational skills" },
];

export const assessmentInputSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(150),
  code: z.string().trim().min(2, "Code must be at least 2 characters").max(40),
  classId: z.string().min(1, "Class is required"),
  subjectId: z.string().min(1, "Subject is required"),
  categoryId: z.string().min(1, "Category is required"),
  termId: z.string().min(1, "Term is required"),
  maxScore: z.number().int().positive().max(1000).default(100),
  dateDue: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD"),
  status: z.enum(["draft", "published"]).default("draft"),
});

export type AssessmentInput = z.infer<typeof assessmentInputSchema>;

export const gradeEntrySchema = z.object({
  studentId: z.string().min(1),
  assessmentId: z.string().min(1),
  score: z.number().min(0, "Score cannot be negative"),
  status: z.enum(["draft", "submitted", "published"]).default("draft"),
  feedback: z.string().trim().max(1000).optional(),
});

export type GradeEntryInput = z.infer<typeof gradeEntrySchema>;

export const gradeCorrectionSchema = z.object({
  assessmentGradeId: z.string().min(1),
  studentId: z.string().min(1),
  previousScore: z.number().min(0),
  newScore: z.number().min(0),
  reason: z.string().trim().min(4, "Audit justification reason must be at least 4 characters").max(500),
  correctedBy: z.string().min(1),
});

export type GradeCorrectionInput = z.infer<typeof gradeCorrectionSchema>;

/**
 * Maps a numeric percentage to a letter grade and grade point.
 */
export function scoreToGrade(percentage: number, scale: GradingScaleEntry[] = STANDARD_LETTER_SCALE): {
  label: string;
  gpaPoint: number;
  description?: string;
} {
  const bounded = Math.max(0, Math.min(100, percentage));
  for (const item of scale) {
    if (bounded >= item.minScore && bounded <= item.maxScore) {
      return { label: item.label, gpaPoint: item.gpaPoint, description: item.description };
    }
  }
  // Fallback to lowest item
  const last = scale[scale.length - 1];
  return { label: last.label, gpaPoint: last.gpaPoint, description: last.description };
}

/**
 * Calculates weighted term performance from assessment categories.
 * Handles partial categories gracefully by normalizing across assessed weights.
 */
export function calculateWeightedTermGrade(
  categories: Array<{ id: string; weight: number }>,
  assessments: Array<{ id: string; categoryId: string; maxScore: number }>,
  grades: Array<{ assessmentId: string; score: number }>,
  scale: GradingScaleEntry[] = STANDARD_LETTER_SCALE,
): {
  percentage: number;
  letterGrade: string;
  gpaPoint: number;
  totalWeightAssessed: number;
  categoryBreakdown: Array<{
    categoryId: string;
    weight: number;
    averagePercentage: number;
    assessmentCount: number;
  }>;
} {
  const gradeMap = new Map<string, number>(grades.map((g) => [g.assessmentId, g.score]));
  let weightedSum = 0;
  let totalAssessedWeight = 0;
  const breakdown: Array<{ categoryId: string; weight: number; averagePercentage: number; assessmentCount: number }> = [];

  for (const cat of categories) {
    const catAssessments = assessments.filter((a) => a.categoryId === cat.id);
    const gradedForCat = catAssessments.filter((a) => gradeMap.has(a.id));

    if (gradedForCat.length > 0) {
      let catSum = 0;
      for (const a of gradedForCat) {
        const score = gradeMap.get(a.id)!;
        const pct = (score / a.maxScore) * 100;
        catSum += pct;
      }
      const catAvg = catSum / gradedForCat.length;
      breakdown.push({
        categoryId: cat.id,
        weight: cat.weight,
        averagePercentage: Math.round(catAvg * 10) / 10,
        assessmentCount: gradedForCat.length,
      });

      weightedSum += catAvg * cat.weight;
      totalAssessedWeight += cat.weight;
    } else {
      breakdown.push({
        categoryId: cat.id,
        weight: cat.weight,
        averagePercentage: 0,
        assessmentCount: 0,
      });
    }
  }

  if (totalAssessedWeight === 0) {
    return {
      percentage: 0,
      letterGrade: "N/A",
      gpaPoint: 0,
      totalWeightAssessed: 0,
      categoryBreakdown: breakdown,
    };
  }

  // Normalized final percentage
  const finalPercentage = Math.round((weightedSum / totalAssessedWeight) * 10) / 10;
  const gradeInfo = scoreToGrade(finalPercentage, scale);

  return {
    percentage: finalPercentage,
    letterGrade: gradeInfo.label,
    gpaPoint: gradeInfo.gpaPoint,
    totalWeightAssessed: totalAssessedWeight,
    categoryBreakdown: breakdown,
  };
}

/**
 * Computes cumulative GPA across a list of subject grade points.
 */
export function calculateCumulativeGpa(subjectGradePoints: number[]): number {
  if (subjectGradePoints.length === 0) return 0.0;
  const sum = subjectGradePoints.reduce((acc, curr) => acc + curr, 0);
  return Math.round((sum / subjectGradePoints.length) * 100) / 100;
}

/**
 * Computes grading progress and publication metrics for a class/subject.
 */
export function calculateGradingProgress(
  totalStudents: number,
  assessmentsCount: number,
  recordedGradesCount: number,
  publishedAssessmentsCount: number,
): {
  expectedEntries: number;
  recordedEntries: number;
  missingEntries: number;
  completionRate: number;
  publicationRate: number;
} {
  const expectedEntries = totalStudents * assessmentsCount;
  const missingEntries = Math.max(0, expectedEntries - recordedGradesCount);
  const completionRate = expectedEntries > 0 ? Math.min(100, Math.round((recordedGradesCount / expectedEntries) * 100)) : 100;
  const publicationRate = assessmentsCount > 0 ? Math.min(100, Math.round((publishedAssessmentsCount / assessmentsCount) * 100)) : 0;

  return {
    expectedEntries,
    recordedEntries: recordedGradesCount,
    missingEntries,
    completionRate,
    publicationRate,
  };
}

/**
 * Visibility rule: guardians and students can ONLY see published items.
 * Staff and teachers can see draft and published items.
 */
export function isGradeVisibleToPersona(
  gradeStatus: GradeStatus,
  assessmentStatus: AssessmentStatus,
  persona: "admin" | "teacher" | "guardian",
): boolean {
  if (persona === "admin" || persona === "teacher") {
    return true;
  }
  return gradeStatus === "published" && assessmentStatus === "published";
}

export interface ReportCardSubjectEntry {
  subjectCode: string;
  subjectName: string;
  department: string;
  teacherName: string;
  scorePercentage: number;
  letterGrade: string;
  gpaPoint: number;
  standardsLevel?: string;
  teacherComments: string;
}

export interface OfficialReportCardData {
  reportCardId: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  gradeLevel: string;
  className: string;
  academicYear: string;
  termName: string;
  version: number;
  status: ReportCardStatus;
  gpa: number;
  overallPercentage: number;
  attendance: {
    attendanceRate: number;
    daysEnrolled: number;
    daysPresent: number;
    daysLate: number;
    daysExcused: number;
    daysAbsent: number;
  };
  subjects: ReportCardSubjectEntry[];
  homeroomTeacherRemarks: string;
  principalRemarks: string;
  publishedAt?: string;
}

