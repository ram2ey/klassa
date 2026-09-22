import { describe, expect, it } from "vitest";
import {
  assessmentInputSchema,
  calculateCumulativeGpa,
  calculateGradingProgress,
  calculateWeightedTermGrade,
  gradeCorrectionSchema,
  isGradeVisibleToPersona,
  scoreToGrade,
  STANDARDS_BASED_SCALE,
} from "./assessments";

describe("Assessments & Grading Calculations", () => {
  it("accurately converts percentage scores to letter grades and GPA points", () => {
    expect(scoreToGrade(98).label).toBe("A+");
    expect(scoreToGrade(98).gpaPoint).toBe(4.0);

    expect(scoreToGrade(94).label).toBe("A");
    expect(scoreToGrade(91).label).toBe("A-");
    expect(scoreToGrade(91).gpaPoint).toBe(3.7);

    expect(scoreToGrade(85).label).toBe("B");
    expect(scoreToGrade(85).gpaPoint).toBe(3.0);

    expect(scoreToGrade(78).label).toBe("C+");
    expect(scoreToGrade(65).label).toBe("D");
    expect(scoreToGrade(55).label).toBe("F");
    expect(scoreToGrade(55).gpaPoint).toBe(0.0);
  });

  it("supports standards-based 4-point rubric scale conversions", () => {
    expect(scoreToGrade(95, STANDARDS_BASED_SCALE).label).toBe("4 - Exceeding");
    expect(scoreToGrade(82, STANDARDS_BASED_SCALE).label).toBe("3 - Meeting");
    expect(scoreToGrade(68, STANDARDS_BASED_SCALE).label).toBe("2 - Approaching");
    expect(scoreToGrade(45, STANDARDS_BASED_SCALE).label).toBe("1 - Emerging");
  });

  it("correctly computes weighted term grades across multiple categories", () => {
    const categories = [
      { id: "cat-quiz", weight: 20 },
      { id: "cat-hw", weight: 20 },
      { id: "cat-mid", weight: 30 },
      { id: "cat-fin", weight: 30 },
    ];

    const assessments = [
      { id: "q1", categoryId: "cat-quiz", maxScore: 100 },
      { id: "q2", categoryId: "cat-quiz", maxScore: 50 },
      { id: "hw1", categoryId: "cat-hw", maxScore: 100 },
      { id: "mid1", categoryId: "cat-mid", maxScore: 100 },
      { id: "fin1", categoryId: "cat-fin", maxScore: 100 },
    ];

    const grades = [
      { assessmentId: "q1", score: 90 }, // 90%
      { assessmentId: "q2", score: 50 }, // 100% -> Quiz avg = 95%
      { assessmentId: "hw1", score: 85 }, // HW avg = 85%
      { assessmentId: "mid1", score: 90 }, // Midterm avg = 90%
      { assessmentId: "fin1", score: 95 }, // Final avg = 95%
    ];

    // Expected: (95 * 20 + 85 * 20 + 90 * 30 + 95 * 30) / 100
    // = (1900 + 1700 + 2700 + 2850) / 100 = 9150 / 100 = 91.5% -> A- (3.7 GPA)
    const result = calculateWeightedTermGrade(categories, assessments, grades);
    expect(result.percentage).toBe(91.5);
    expect(result.letterGrade).toBe("A-");
    expect(result.gpaPoint).toBe(3.7);
    expect(result.totalWeightAssessed).toBe(100);
  });

  it("normalizes weighted score when only partial categories have assessments", () => {
    const categories = [
      { id: "cat-quiz", weight: 20 },
      { id: "cat-hw", weight: 20 },
      { id: "cat-fin", weight: 60 },
    ];

    const assessments = [
      { id: "q1", categoryId: "cat-quiz", maxScore: 100 },
      { id: "hw1", categoryId: "cat-hw", maxScore: 100 },
    ];

    const grades = [
      { assessmentId: "q1", score: 80 }, // 80% (weight 20)
      { assessmentId: "hw1", score: 100 }, // 100% (weight 20)
    ];

    // Total assessed weight = 40
    // (80 * 20 + 100 * 20) / 40 = (1600 + 2000) / 40 = 3600 / 40 = 90.0% -> A-
    const result = calculateWeightedTermGrade(categories, assessments, grades);
    expect(result.percentage).toBe(90);
    expect(result.letterGrade).toBe("A-");
    expect(result.totalWeightAssessed).toBe(40);
  });

  it("calculates cumulative GPA across subjects accurately", () => {
    // 4.0, 3.7, 3.3, 3.0 -> Average: 14.0 / 4 = 3.50
    expect(calculateCumulativeGpa([4.0, 3.7, 3.3, 3.0])).toBe(3.5);
    expect(calculateCumulativeGpa([])).toBe(0.0);
  });

  it("calculates grading completion and publication progress", () => {
    // 25 students, 4 assessments = 100 expected entries
    // 75 recorded, 3 of 4 published
    const progress = calculateGradingProgress(25, 4, 75, 3);
    expect(progress.expectedEntries).toBe(100);
    expect(progress.recordedEntries).toBe(75);
    expect(progress.missingEntries).toBe(25);
    expect(progress.completionRate).toBe(75);
    expect(progress.publicationRate).toBe(75);
  });

  it("enforces strict visibility rules between teachers and guardians", () => {
    // Teachers & Admins see everything
    expect(isGradeVisibleToPersona("draft", "draft", "teacher")).toBe(true);
    expect(isGradeVisibleToPersona("draft", "published", "teacher")).toBe(true);
    expect(isGradeVisibleToPersona("published", "published", "teacher")).toBe(true);
    expect(isGradeVisibleToPersona("draft", "draft", "admin")).toBe(true);

    // Guardians only see published grades for published assessments
    expect(isGradeVisibleToPersona("draft", "published", "guardian")).toBe(false);
    expect(isGradeVisibleToPersona("published", "draft", "guardian")).toBe(false);
    expect(isGradeVisibleToPersona("draft", "draft", "guardian")).toBe(false);
    expect(isGradeVisibleToPersona("published", "published", "guardian")).toBe(true);
  });

  it("validates mandatory justification reason for grade modifications", () => {
    const valid = {
      assessmentGradeId: "grd-101",
      studentId: "ST-2026-0142",
      previousScore: 82,
      newScore: 89,
      reason: "Regraded essay after rubric review meeting",
      correctedBy: "Elena Rostova",
    };
    expect(gradeCorrectionSchema.safeParse(valid).success).toBe(true);

    const invalidShortReason = {
      ...valid,
      reason: "fix", // too short (< 4 chars)
    };
    expect(gradeCorrectionSchema.safeParse(invalidShortReason).success).toBe(false);
  });

  it("validates assessment input schema correctly", () => {
    const validAssessment = {
      title: "Algebra Unit 1 Exam",
      code: "MATH-EX-01",
      classId: "cls-7b",
      subjectId: "sub-mat",
      categoryId: "cat-mid",
      termId: "term-fall-2026",
      maxScore: 100,
      dateDue: "2026-10-15",
      status: "draft" as const,
    };
    expect(assessmentInputSchema.safeParse(validAssessment).success).toBe(true);

    const invalidDate = {
      ...validAssessment,
      dateDue: "not-a-date",
    };
    expect(assessmentInputSchema.safeParse(invalidDate).success).toBe(false);
  });
});

