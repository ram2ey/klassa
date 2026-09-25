import { z } from "zod";

const id = z.uuid();
const name = z.string().trim().min(1, "Enter a name.").max(100);
const optionalId = z.union([id, z.literal("")]).optional();
const dates = { startsOn: z.iso.date(), endsOn: z.iso.date() };

export const schoolCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("student"), id: id.optional(),
    firstName: name, lastName: name, dateOfBirth: z.iso.date(),
    status: z.enum(["pending", "active", "withdrawn", "graduated"]), classId: optionalId }),
  z.object({ kind: z.literal("guardian"), id: id.optional(), firstName: name, lastName: name,
    email: z.union([z.email().max(254), z.literal("")]), phone: z.string().trim().max(40) }),
  z.object({ kind: z.literal("guardian_link"), studentId: id, guardianId: id,
    relationship: z.enum(["parent", "guardian", "foster_carer", "other"]), isPrimary: z.boolean(), hasLegalResponsibility: z.boolean() }),
  z.object({ kind: z.literal("grade"), id: id.optional(), name: name.max(80), position: z.number().int().min(0).max(100) }),
  z.object({ kind: z.literal("class"), id: id.optional(), name: name.max(80), academicYearId: id, gradeLevelId: id, homeroomTeacherId: z.string().max(200).optional() }),
  z.object({ kind: z.literal("subject"), id: id.optional(), code: z.string().trim().min(1).max(30), name: name.max(100), department: z.string().trim().max(80) }),
  z.object({ kind: z.literal("year"), id: id.optional(), name: name.max(50), ...dates, isCurrent: z.boolean() }),
  z.object({ kind: z.literal("term"), id: id.optional(), academicYearId: id, name: name.max(80), ...dates, position: z.number().int().min(1).max(20) }),
  z.object({ kind: z.literal("settings"), name: z.string().trim().min(2).max(180) }),
  z.object({ kind: z.literal("staff_role"), membershipId: id, role: z.enum(["school_admin", "office_staff", "teacher", "safeguarding_lead", "senco", "health_nurse"]) }),
]).superRefine((value, context) => {
  if ((value.kind === "year" || value.kind === "term") && value.endsOn < value.startsOn) {
    context.addIssue({ code: "custom", path: ["endsOn"], message: "End date must be on or after the start date." });
  }
  if (value.kind === "student" && value.dateOfBirth > new Date().toISOString().slice(0, 10)) {
    context.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Date of birth cannot be in the future." });
  }
});

export const bulkStudentUpdateSchema = z.object({
  studentIds: z.array(id).min(1, "Select at least one student.").max(100, "Update at most 100 students at a time.").refine(ids => new Set(ids).size === ids.length, "A student was selected more than once."),
  status: z.enum(["pending", "active", "withdrawn", "graduated"]).optional(),
  classId: id.optional(),
}).refine(value => value.status !== undefined || value.classId !== undefined, "Choose a status or class change.");

export type SchoolCommand = z.input<typeof schoolCommandSchema>;
export type BulkStudentUpdate = z.input<typeof bulkStudentUpdateSchema>;
export class SchoolAdminError extends Error {}
