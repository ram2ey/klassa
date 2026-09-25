import { z } from "zod";

export const studentInputSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  middleName: z.string().trim().max(100).optional(),
  lastName: z.string().trim().min(1).max(100),
  preferredName: z.string().trim().max(100).optional(),
  dateOfBirth: z.iso.date(),
  gradeLevel: z.string().trim().min(1).max(80),
  className: z.string().trim().min(1).max(80),
});

export const studentCsvInputSchema = studentInputSchema.extend({
  externalReference: z.string().trim().min(1).max(100).optional(),
});

export const studentCsvHeaders = [
  "externalReference", "firstName", "middleName", "lastName",
  "preferredName", "dateOfBirth", "gradeLevel", "className",
] as const;

export type StudentInput = z.infer<typeof studentInputSchema>;
export type StudentCsvInput = z.infer<typeof studentCsvInputSchema>;
