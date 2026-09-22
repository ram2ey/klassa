import { z } from "zod";

export const studentInputSchema = z.object({
  studentNumber: z.string().trim().min(1).max(50),
  firstName: z.string().trim().min(1).max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1).max(100),
  preferredName: z.string().trim().max(100).optional(),
  dateOfBirth: z.iso.date(),
  gradeLevel: z.string().trim().min(1).max(80),
  className: z.string().trim().min(1).max(80),
});

export const studentCsvHeaders = [
  "studentNumber", "firstName", "middleName", "lastName",
  "preferredName", "dateOfBirth", "gradeLevel", "className",
] as const;

export type StudentInput = z.infer<typeof studentInputSchema>;
