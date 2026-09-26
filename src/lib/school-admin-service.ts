import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, classes, enrollments, gradeLevels, guardians, organizationMemberships, organizations,
  studentGuardians, students, subjects, teacherClassAssignments, terms } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { SCHOOL_TIME_ZONE } from "@/lib/timezone";
import { bulkStudentUpdateSchema, schoolCommandSchema, SchoolAdminError, type BulkStudentUpdate, type SchoolCommand } from "@/lib/school-admin-policy";
import type { requireStaff } from "@/lib/action-access";
import { allocateStudentNumbers } from "@/lib/student-number";

type Actor = Awaited<ReturnType<typeof requireStaff>>;
function found<T>(row: T | undefined, label: string): T {
  if (!row) throw new SchoolAdminError(`${label} was not found in your school.`);
  return row;
}

/** Called only after server authorization; every referenced record is checked in this tenant. */
export async function saveSchoolRecord(actor: Actor, raw: SchoolCommand) {
  const value = schoolCommandSchema.parse(raw);
  if (actor.role !== "school_admin" && !(actor.role === "office_staff" && ["student", "guardian", "guardian_link"].includes(value.kind))) {
    throw new SchoolAdminError("You cannot change this school record.");
  }
  const org = actor.organizationId;
  return db.transaction(async tx => {
    // Serialize school setup changes, including current-year and primary-contact selection.
    found((await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, org)).for("update"))[0], "School");
    let entityId: string;
    switch (value.kind) {
      case "student": {
        const { id, classId } = value;
        const fields = { firstName: value.firstName, lastName: value.lastName,
          dateOfBirth: value.dateOfBirth, status: value.status };
        if (id) found((await tx.select({ id: students.id }).from(students).where(and(eq(students.id, id), eq(students.organizationId, org))))[0], "Student");
        const [currentYear] = await tx.select().from(academicYears).where(and(eq(academicYears.organizationId, org), eq(academicYears.isCurrent, true)));
        if (!id && !classId) throw new SchoolAdminError("Create a current academic year and class before enrolling a student.");
        if (classId) {
          if (!currentYear) throw new SchoolAdminError("Choose a current academic year first.");
          found((await tx.select({ id: classes.id }).from(classes).where(and(eq(classes.id, classId), eq(classes.organizationId, org), eq(classes.academicYearId, currentYear.id))))[0], "Class in the current academic year");
        }
        const [saved] = id
          ? await tx.update(students).set({ ...fields, updatedAt: new Date() }).where(and(eq(students.id, id), eq(students.organizationId, org))).returning({ id: students.id })
          : await tx.insert(students).values({ ...fields, organizationId: org,
              studentNumber: (await allocateStudentNumbers(tx, org, 1))[0] }).returning({ id: students.id });
        entityId = found(saved, "Student").id;
        if (classId && currentYear) {
          await tx.insert(enrollments).values({ organizationId: org, studentId: entityId, academicYearId: currentYear.id,
            classId, status: value.status, startsOn: new Date().toISOString().slice(0, 10) })
            .onConflictDoUpdate({ target: [enrollments.studentId, enrollments.academicYearId],
              set: { classId, status: value.status, updatedAt: new Date() }, setWhere: eq(enrollments.organizationId, org) });
        } else if (currentYear) {
          await tx.update(enrollments).set({ status: value.status, updatedAt: new Date() })
            .where(and(eq(enrollments.organizationId, org), eq(enrollments.studentId, entityId), eq(enrollments.academicYearId, currentYear.id)));
        }
        break;
      }
      case "guardian": {
        const fields = { firstName: value.firstName, lastName: value.lastName, email: value.email || null, phone: value.phone || null };
        const [saved] = value.id
          ? await tx.update(guardians).set({ ...fields, updatedAt: new Date() }).where(and(eq(guardians.id, value.id), eq(guardians.organizationId, org))).returning({ id: guardians.id })
          : await tx.insert(guardians).values({ ...fields, organizationId: org }).returning({ id: guardians.id });
        entityId = found(saved, "Guardian").id;
        break;
      }
      case "guardian_link": {
        found((await tx.select({ id: students.id }).from(students).where(and(eq(students.id, value.studentId), eq(students.organizationId, org))))[0], "Student");
        found((await tx.select({ id: guardians.id }).from(guardians).where(and(eq(guardians.id, value.guardianId), eq(guardians.organizationId, org))))[0], "Guardian");
        if (value.isPrimary) await tx.update(studentGuardians).set({ isPrimary: false, updatedAt: new Date() })
          .where(and(eq(studentGuardians.organizationId, org), eq(studentGuardians.studentId, value.studentId)));
        const fields = { relationship: value.relationship, isPrimary: value.isPrimary, hasLegalResponsibility: value.hasLegalResponsibility };
        const [saved] = await tx.insert(studentGuardians).values({ ...fields, organizationId: org, studentId: value.studentId, guardianId: value.guardianId })
          .onConflictDoUpdate({ target: [studentGuardians.studentId, studentGuardians.guardianId], set: { ...fields, updatedAt: new Date() },
            setWhere: eq(studentGuardians.organizationId, org) }).returning({ id: studentGuardians.id });
        entityId = found(saved, "Guardian relationship").id;
        break;
      }
      case "grade": {
        const [duplicate] = await tx.select({ id: gradeLevels.id }).from(gradeLevels).where(and(eq(gradeLevels.organizationId, org),
          sql`lower(${gradeLevels.name}) = lower(${value.name})`, value.id ? ne(gradeLevels.id, value.id) : undefined));
        if (duplicate) throw new SchoolAdminError("A grade with this name already exists.");
        const fields = { name: value.name, position: value.position };
        const [saved] = value.id
          ? await tx.update(gradeLevels).set({ ...fields, updatedAt: new Date() }).where(and(eq(gradeLevels.id, value.id), eq(gradeLevels.organizationId, org))).returning({ id: gradeLevels.id })
          : await tx.insert(gradeLevels).values({ ...fields, organizationId: org }).returning({ id: gradeLevels.id });
        entityId = found(saved, "Grade").id;
        break;
      }
      case "class": {
        found((await tx.select({ id: academicYears.id }).from(academicYears).where(and(eq(academicYears.id, value.academicYearId), eq(academicYears.organizationId, org))))[0], "Academic year");
        found((await tx.select({ id: gradeLevels.id }).from(gradeLevels).where(and(eq(gradeLevels.id, value.gradeLevelId), eq(gradeLevels.organizationId, org))))[0], "Grade");
        if (value.homeroomTeacherId) {
          const member = found((await tx.select({ role: organizationMemberships.role }).from(organizationMemberships).where(and(eq(organizationMemberships.userId, value.homeroomTeacherId), eq(organizationMemberships.organizationId, org))))[0], "Teacher");
          if (member.role !== "teacher" && member.role !== "school_admin") throw new SchoolAdminError("Choose a teacher or school administrator as homeroom teacher.");
        }
        if (value.id) {
          const previous = found((await tx.select().from(classes).where(and(eq(classes.id, value.id), eq(classes.organizationId, org))))[0], "Class");
          if (previous.academicYearId !== value.academicYearId) throw new SchoolAdminError("Create a new class for a different academic year.");
        }
        const [duplicate] = await tx.select({ id: classes.id }).from(classes).where(and(eq(classes.organizationId, org), eq(classes.academicYearId, value.academicYearId),
          eq(classes.gradeLevelId, value.gradeLevelId), sql`lower(${classes.name}) = lower(${value.name})`, value.id ? ne(classes.id, value.id) : undefined));
        if (duplicate) throw new SchoolAdminError("This class already exists for the selected year and grade.");
        const fields = { name: value.name, academicYearId: value.academicYearId, gradeLevelId: value.gradeLevelId, homeroomTeacherId: value.homeroomTeacherId || null };
        const [saved] = value.id
          ? await tx.update(classes).set({ ...fields, updatedAt: new Date() }).where(and(eq(classes.id, value.id), eq(classes.organizationId, org))).returning({ id: classes.id })
          : await tx.insert(classes).values({ ...fields, organizationId: org }).returning({ id: classes.id });
        entityId = found(saved, "Class").id;
        await tx.delete(teacherClassAssignments).where(and(eq(teacherClassAssignments.organizationId, org), eq(teacherClassAssignments.classId, entityId), eq(teacherClassAssignments.isPrimaryHomeroom, true)));
        if (value.homeroomTeacherId) await tx.insert(teacherClassAssignments).values({ organizationId: org, classId: entityId, teacherId: value.homeroomTeacherId, isPrimaryHomeroom: true });
        break;
      }
      case "teacher_subject_assignment": {
        found((await tx.select({ id: classes.id }).from(classes).where(and(eq(classes.id, value.classId), eq(classes.organizationId, org))))[0], "Class");
        found((await tx.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, value.subjectId), eq(subjects.organizationId, org))))[0], "Subject");
        const member = found((await tx.select({ role: organizationMemberships.role }).from(organizationMemberships).where(and(
          eq(organizationMemberships.userId, value.teacherId), eq(organizationMemberships.organizationId, org))))[0], "Teacher");
        if (member.role !== "teacher") throw new SchoolAdminError("Choose a staff member with the teacher role.");
        if (value.id) {
          const previous = found((await tx.select({ isPrimaryHomeroom: teacherClassAssignments.isPrimaryHomeroom })
            .from(teacherClassAssignments).where(and(eq(teacherClassAssignments.id, value.id), eq(teacherClassAssignments.organizationId, org))))[0], "Subject assignment");
          if (previous.isPrimaryHomeroom) throw new SchoolAdminError("Edit homeroom teachers through the class record.");
        }
        const [duplicate] = await tx.select({ id: teacherClassAssignments.id }).from(teacherClassAssignments).where(and(
          eq(teacherClassAssignments.organizationId, org), eq(teacherClassAssignments.classId, value.classId),
          eq(teacherClassAssignments.subjectId, value.subjectId), eq(teacherClassAssignments.teacherId, value.teacherId),
          value.id ? ne(teacherClassAssignments.id, value.id) : undefined));
        if (duplicate) throw new SchoolAdminError("This teacher already has that class and subject assignment.");
        const fields = { classId: value.classId, subjectId: value.subjectId, teacherId: value.teacherId, isPrimaryHomeroom: false };
        const [saved] = value.id
          ? await tx.update(teacherClassAssignments).set({ ...fields, updatedAt: new Date() })
            .where(and(eq(teacherClassAssignments.id, value.id), eq(teacherClassAssignments.organizationId, org),
              eq(teacherClassAssignments.isPrimaryHomeroom, false))).returning({ id: teacherClassAssignments.id })
          : await tx.insert(teacherClassAssignments).values({ ...fields, organizationId: org }).returning({ id: teacherClassAssignments.id });
        entityId = found(saved, "Subject assignment").id;
        break;
      }
      case "teacher_subject_assignment_remove": {
        const assignment = found((await tx.select({ id: teacherClassAssignments.id, isPrimaryHomeroom: teacherClassAssignments.isPrimaryHomeroom })
          .from(teacherClassAssignments).where(and(eq(teacherClassAssignments.id, value.id), eq(teacherClassAssignments.organizationId, org))))[0], "Subject assignment");
        if (assignment.isPrimaryHomeroom) throw new SchoolAdminError("Edit homeroom teachers through the class record.");
        await tx.delete(teacherClassAssignments).where(and(eq(teacherClassAssignments.id, assignment.id),
          eq(teacherClassAssignments.organizationId, org), eq(teacherClassAssignments.isPrimaryHomeroom, false)));
        entityId = assignment.id;
        break;
      }
      case "subject": {
        const fields = { code: value.code, name: value.name, department: value.department || null };
        const [saved] = value.id
          ? await tx.update(subjects).set({ ...fields, updatedAt: new Date() }).where(and(eq(subjects.id, value.id), eq(subjects.organizationId, org))).returning({ id: subjects.id })
          : await tx.insert(subjects).values({ ...fields, organizationId: org }).returning({ id: subjects.id });
        entityId = found(saved, "Subject").id;
        break;
      }
      case "year": {
        if (value.id) {
          found((await tx.select({ id: academicYears.id }).from(academicYears).where(and(eq(academicYears.id, value.id), eq(academicYears.organizationId, org))))[0], "Academic year");
          const existingTerms = await tx.select().from(terms).where(and(eq(terms.organizationId, org), eq(terms.academicYearId, value.id)));
          if (existingTerms.some(term => term.startsOn < value.startsOn || term.endsOn > value.endsOn)) throw new SchoolAdminError("Academic year dates must contain all of its terms.");
        }
        if (value.isCurrent) await tx.update(academicYears).set({ isCurrent: false, updatedAt: new Date() }).where(eq(academicYears.organizationId, org));
        const fields = { name: value.name, startsOn: value.startsOn, endsOn: value.endsOn, isCurrent: value.isCurrent };
        const [saved] = value.id
          ? await tx.update(academicYears).set({ ...fields, updatedAt: new Date() }).where(and(eq(academicYears.id, value.id), eq(academicYears.organizationId, org))).returning({ id: academicYears.id })
          : await tx.insert(academicYears).values({ ...fields, organizationId: org }).returning({ id: academicYears.id });
        entityId = found(saved, "Academic year").id;
        break;
      }
      case "term": {
        const year = found((await tx.select().from(academicYears).where(and(eq(academicYears.id, value.academicYearId), eq(academicYears.organizationId, org))))[0], "Academic year");
        if (value.startsOn < year.startsOn || value.endsOn > year.endsOn) throw new SchoolAdminError("Term dates must fall within the academic year.");
        if (value.id) {
          const previous = found((await tx.select().from(terms).where(and(eq(terms.id, value.id), eq(terms.organizationId, org))))[0], "Term");
          if (previous.academicYearId !== value.academicYearId) throw new SchoolAdminError("Create a new term for a different academic year.");
        }
        const fields = { name: value.name, academicYearId: value.academicYearId, startsOn: value.startsOn, endsOn: value.endsOn, position: value.position };
        const [saved] = value.id
          ? await tx.update(terms).set({ ...fields, updatedAt: new Date() }).where(and(eq(terms.id, value.id), eq(terms.organizationId, org))).returning({ id: terms.id })
          : await tx.insert(terms).values({ ...fields, organizationId: org }).returning({ id: terms.id });
        entityId = found(saved, "Term").id;
        break;
      }
      case "settings": {
        await tx.update(organizations).set({ name: value.name, timezone: SCHOOL_TIME_ZONE, updatedAt: new Date() }).where(eq(organizations.id, org));
        entityId = org;
        break;
      }
      case "staff_role": {
        const member = found((await tx.select().from(organizationMemberships).where(and(eq(organizationMemberships.id, value.membershipId), eq(organizationMemberships.organizationId, org))))[0], "Staff member");
        if (member.userId === actor.userId) throw new SchoolAdminError("Ask another school administrator to change your role.");
        if (member.role === "school_admin" && value.role !== "school_admin") {
          const [admins] = await tx.select({ total: count() }).from(organizationMemberships)
            .where(and(eq(organizationMemberships.organizationId, org), eq(organizationMemberships.role, "school_admin")));
          if ((admins?.total ?? 0) <= 1) throw new SchoolAdminError("This is the last school administrator. Add another administrator before changing this role.");
        }
        await tx.update(organizationMemberships).set({ role: value.role, updatedAt: new Date() }).where(and(eq(organizationMemberships.id, member.id), eq(organizationMemberships.organizationId, org)));
        if (value.role !== "teacher" && value.role !== "school_admin") {
          await tx.update(classes).set({ homeroomTeacherId: null, updatedAt: new Date() }).where(and(eq(classes.organizationId, org), eq(classes.homeroomTeacherId, member.userId)));
          await tx.delete(teacherClassAssignments).where(and(eq(teacherClassAssignments.organizationId, org), eq(teacherClassAssignments.teacherId, member.userId)));
        }
        entityId = member.id;
        break;
      }
    }
    await logAuditEvent({ organizationId: org, actorUserId: actor.userId, action: `${value.kind}.saved`,
      entityType: value.kind, entityId, metadata: value.kind === "staff_role" ? { role: value.role } : {} }, tx);
    return { entityId };
  });
}

export async function bulkUpdateSchoolStudents(actor: Actor, raw: BulkStudentUpdate) {
  const value = bulkStudentUpdateSchema.parse(raw);
  if (actor.role !== "school_admin") throw new SchoolAdminError("Only a school administrator can run bulk student updates.");
  const org = actor.organizationId;
  return db.transaction(async tx => {
    found((await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, org)).for("update"))[0], "School");
    const selected = await tx.select({ id: students.id, status: students.status }).from(students)
      .where(and(eq(students.organizationId, org), inArray(students.id, value.studentIds)));
    if (selected.length !== value.studentIds.length) throw new SchoolAdminError("One or more selected students could not be found in this school. Refresh the directory and try again.");
    const [currentYear] = await tx.select().from(academicYears).where(and(eq(academicYears.organizationId, org), eq(academicYears.isCurrent, true)));
    if (value.classId) {
      if (!currentYear) throw new SchoolAdminError("Choose a current academic year before assigning a class.");
      found((await tx.select({ id: classes.id }).from(classes).where(and(eq(classes.id, value.classId), eq(classes.organizationId, org), eq(classes.academicYearId, currentYear.id))))[0], "Class in the current academic year");
    }
    if (value.status) {
      await tx.update(students).set({ status: value.status, updatedAt: new Date() })
        .where(and(eq(students.organizationId, org), inArray(students.id, value.studentIds)));
    }
    if (currentYear && value.classId) {
      for (const item of selected) {
        await tx.insert(enrollments).values({ organizationId: org, studentId: item.id, academicYearId: currentYear.id,
          classId: value.classId ?? null, status: value.status ?? item.status, startsOn: new Date().toISOString().slice(0, 10) })
          .onConflictDoUpdate({ target: [enrollments.studentId, enrollments.academicYearId],
            set: { ...(value.classId ? { classId: value.classId } : {}), ...(value.status ? { status: value.status } : {}), updatedAt: new Date() },
            setWhere: eq(enrollments.organizationId, org) });
      }
    } else if (currentYear && value.status) {
      await tx.update(enrollments).set({ status: value.status, updatedAt: new Date() })
        .where(and(eq(enrollments.organizationId, org), eq(enrollments.academicYearId, currentYear.id), inArray(enrollments.studentId, value.studentIds)));
    }
    for (const id of value.studentIds) await logAuditEvent({ organizationId: org, actorUserId: actor.userId,
      action: "student.bulk_updated", entityType: "student", entityId: id,
      metadata: { ...(value.status ? { status: value.status } : {}), ...(value.classId ? { classId: value.classId } : {}) } }, tx);
    return { updatedCount: value.studentIds.length };
  });
}
