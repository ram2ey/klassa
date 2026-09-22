import { studentCsvHeaders, studentInputSchema, type StudentInput } from "./validation/student";

export interface CsvRowError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

export interface CsvValidationResult {
  isValid: boolean;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  headers: string[];
  missingHeaders: string[];
  validRecords: StudentInput[];
  invalidRecords: Array<{
    row: number;
    data: Record<string, string>;
    errors: CsvRowError[];
  }>;
}

/**
 * Standard RFC 4180 CSV parser
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let insideQuotes = false;

  const sanitized = text.replace(/^\uFEFF/, ""); // Strip UTF-8 BOM if present

  for (let i = 0; i < sanitized.length; i++) {
    const char = sanitized[i];
    const nextChar = sanitized[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // Skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === "," && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++; // Handle CRLF
      }
      currentRow.push(currentField.trim());
      if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  if (currentField !== "" || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.length > 1 || (currentRow.length === 1 && currentRow[0] !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export function validateStudentCsv(csvText: string): CsvValidationResult {
  const rows = parseCsv(csvText);

  if (rows.length === 0) {
    return {
      isValid: false,
      totalRows: 0,
      validCount: 0,
      invalidCount: 0,
      headers: [],
      missingHeaders: [...studentCsvHeaders],
      validRecords: [],
      invalidRecords: [],
    };
  }

  const rawHeaders = rows[0].map((h) => h.trim());
  const headerMap = new Map<string, number>();
  rawHeaders.forEach((h, idx) => {
    headerMap.set(h, idx);
  });

  const requiredHeaders = ["studentNumber", "firstName", "lastName", "dateOfBirth", "gradeLevel", "className"];
  const missingHeaders = requiredHeaders.filter((req) => !headerMap.has(req));

  if (missingHeaders.length > 0) {
    return {
      isValid: false,
      totalRows: rows.length - 1,
      validCount: 0,
      invalidCount: rows.length - 1,
      headers: rawHeaders,
      missingHeaders,
      validRecords: [],
      invalidRecords: [],
    };
  }

  const validRecords: StudentInput[] = [];
  const invalidRecords: Array<{ row: number; data: Record<string, string>; errors: CsvRowError[] }> = [];

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const rowData: Record<string, string> = {};

    rawHeaders.forEach((header, colIndex) => {
      rowData[header] = row[colIndex] ?? "";
    });

    const parsedCandidate: Record<string, unknown> = {
      studentNumber: rowData.studentNumber || undefined,
      firstName: rowData.firstName || undefined,
      middleName: rowData.middleName || undefined,
      lastName: rowData.lastName || undefined,
      preferredName: rowData.preferredName || undefined,
      dateOfBirth: rowData.dateOfBirth || undefined,
      gradeLevel: rowData.gradeLevel || undefined,
      className: rowData.className || undefined,
    };

    const parseResult = studentInputSchema.safeParse(parsedCandidate);

    if (parseResult.success) {
      validRecords.push(parseResult.data);
    } else {
      const errors: CsvRowError[] = parseResult.error.issues.map((issue) => ({
        row: rowIndex + 1, // 1-based, accounting for header row
        field: issue.path.join("."),
        message: issue.message,
        value: String(rowData[issue.path[0] as string] ?? ""),
      }));

      invalidRecords.push({
        row: rowIndex + 1,
        data: rowData,
        errors,
      });
    }
  }

  return {
    isValid: invalidRecords.length === 0 && validRecords.length > 0,
    totalRows: rows.length - 1,
    validCount: validRecords.length,
    invalidCount: invalidRecords.length,
    headers: rawHeaders,
    missingHeaders: [],
    validRecords,
    invalidRecords,
  };
}

export function generateStudentCsvTemplate(): string {
  const headerLine = studentCsvHeaders.join(",");
  const sample1 = "ST-2026-0201,Emma,Grace,Watson,Emma,2014-04-15,Grade 7,7A";
  const sample2 = "ST-2026-0202,Lucas,,Mendoza,,2015-09-22,Grade 6,6B";
  return `${headerLine}\n${sample1}\n${sample2}\n`;
}

