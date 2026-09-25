import { describe, expect, it } from "vitest";
import { studentInputSchema } from "./student";

const validStudent = {
  firstName: "Amelia",
  lastName: "Warren",
  dateOfBirth: "2014-05-12",
  gradeLevel: "Grade 7",
  className: "7B",
};

describe("studentInputSchema", () => {
  it("accepts a complete student record", () => {
    expect(studentInputSchema.safeParse(validStudent).success).toBe(true);
  });

  it("rejects invalid dates and missing names", () => {
    const result = studentInputSchema.safeParse({ ...validStudent, firstName: "", dateOfBirth: "12/05/2014" });
    expect(result.success).toBe(false);
  });
});
