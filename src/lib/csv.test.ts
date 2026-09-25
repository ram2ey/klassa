import { describe, expect, it } from "vitest";
import { generateStudentCsvTemplate, parseCsv, validateStudentCsv } from "./csv";

describe("CSV parsing and validation", () => {
  it("correctly parses raw CSV lines with quotes and commas", () => {
    const raw = `studentNumber,firstName,lastName\n"ST-001","John, Jr.","Doe"\nST-002,Jane,Smith`;
    const parsed = parseCsv(raw);
    expect(parsed).toHaveLength(3);
    expect(parsed[1][1]).toBe("John, Jr.");
    expect(parsed[2][0]).toBe("ST-002");
  });

  it("validates a properly formatted template", () => {
    const template = generateStudentCsvTemplate();
    const result = validateStudentCsv(template);
    expect(result.isValid).toBe(true);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(0);
    expect(result.validRecords[0].externalReference).toBe("OLD-0201");
  });

  it("identifies missing required headers", () => {
    const badHeaders = "firstName,lastName,dateOfBirth\nJohn,Doe,2014-01-01";
    const result = validateStudentCsv(badHeaders);
    expect(result.isValid).toBe(false);
    expect(result.missingHeaders).toContain("gradeLevel");
    expect(result.missingHeaders).toContain("className");
  });

  it("reports detailed row errors for malformed dates and conflicting legacy references", () => {
    const testCsv = [
      "externalReference,studentNumber,firstName,middleName,lastName,preferredName,dateOfBirth,gradeLevel,className",
      "OLD-1,OLD-2,Alice,,Walker,,2015-05-10,Grade 6,6A",
      "OLD-3,,Bob,,Ross,,not-a-date,Grade 7,7B",
    ].join("\n");

    const result = validateStudentCsv(testCsv);
    expect(result.isValid).toBe(false);
    expect(result.validCount).toBe(0);
    expect(result.invalidCount).toBe(2);

    const firstRowErrors = result.invalidRecords.find((r) => r.row === 2);
    expect(firstRowErrors?.errors[0].field).toBe("externalReference");

    const secondRowErrors = result.invalidRecords.find((r) => r.row === 3);
    expect(secondRowErrors?.errors[0].field).toBe("dateOfBirth");
  });
});
