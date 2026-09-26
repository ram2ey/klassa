import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { clinicVisits, courtRestrictions, needToKnowAlerts, organizations, sensitiveAccessLogs, sensitiveCaseNotes,
  sensitiveCases, senProfiles, senReviews, students } from "@/db/schema";
import { requireStaff } from "@/lib/action-access";
import { isSpecialistRole, specialistAreas } from "@/lib/specialist-access";

export async function getSpecialistData() {
  const actor = await requireStaff(["safeguarding_lead", "senco", "health_nurse"]);
  if (!isSpecialistRole(actor.role)) throw new Error("Specialist access required.");
  const org = actor.organizationId;
  const [school, studentRows, cases] = await Promise.all([
    db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(eq(organizations.id, org)).then(rows => rows[0]),
    db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName, studentNumber: students.studentNumber })
      .from(students).where(eq(students.organizationId, org)).orderBy(students.lastName, students.firstName),
    db.select({ id: sensitiveCases.id, studentId: sensitiveCases.studentId, caseNumber: sensitiveCases.caseNumber,
      area: sensitiveCases.area, confidentialityTier: sensitiveCases.confidentialityTier, title: sensitiveCases.title,
      status: sensitiveCases.status, createdAt: sensitiveCases.createdAt, updatedAt: sensitiveCases.updatedAt })
      .from(sensitiveCases).where(and(eq(sensitiveCases.organizationId, org), inArray(sensitiveCases.area, specialistAreas(actor.role))))
      .orderBy(desc(sensitiveCases.updatedAt)),
  ]);
  if (!school) throw new Error("School not found.");
  const caseIds = cases.map(row => row.id);
  const [notes, accessLogs, alerts, restrictions, visits, profiles, reviews] = await Promise.all([
    caseIds.length ? db.select({ id: sensitiveCaseNotes.id, caseId: sensitiveCaseNotes.caseId,
      noteType: sensitiveCaseNotes.noteType, createdAt: sensitiveCaseNotes.createdAt })
      .from(sensitiveCaseNotes).where(and(eq(sensitiveCaseNotes.organizationId, org), inArray(sensitiveCaseNotes.caseId, caseIds)))
      .orderBy(desc(sensitiveCaseNotes.createdAt)) : [],
    caseIds.length ? db.select({ id: sensitiveAccessLogs.id, caseId: sensitiveAccessLogs.caseId,
      action: sensitiveAccessLogs.action, accessReason: sensitiveAccessLogs.accessReason, accessedAt: sensitiveAccessLogs.accessedAt })
      .from(sensitiveAccessLogs).where(and(eq(sensitiveAccessLogs.organizationId, org), inArray(sensitiveAccessLogs.caseId, caseIds)))
      .orderBy(desc(sensitiveAccessLogs.accessedAt)).limit(100) : [],
    caseIds.length ? db.select({ id: needToKnowAlerts.id, caseId: needToKnowAlerts.caseId,
      studentId: needToKnowAlerts.studentId, category: needToKnowAlerts.category,
      severity: needToKnowAlerts.severity, directiveSummary: needToKnowAlerts.directiveSummary,
      actionRequired: needToKnowAlerts.actionRequired, isActive: needToKnowAlerts.isActive,
      expiresAt: needToKnowAlerts.expiresAt })
      .from(needToKnowAlerts).where(and(eq(needToKnowAlerts.organizationId, org), inArray(needToKnowAlerts.caseId, caseIds)))
      .orderBy(desc(needToKnowAlerts.createdAt)) : [],
    actor.role === "safeguarding_lead" ? db.select().from(courtRestrictions)
      .where(eq(courtRestrictions.organizationId, org)).orderBy(desc(courtRestrictions.createdAt)) : [],
    actor.role === "health_nurse" ? db.select().from(clinicVisits)
      .where(eq(clinicVisits.organizationId, org)).orderBy(desc(clinicVisits.visitDate), desc(clinicVisits.createdAt)).limit(100) : [],
    actor.role === "senco" ? db.select().from(senProfiles)
      .where(eq(senProfiles.organizationId, org)).orderBy(senProfiles.nextReviewDate) : [],
    actor.role === "senco" ? db.select().from(senReviews)
      .where(eq(senReviews.organizationId, org)).orderBy(desc(senReviews.reviewDate)).limit(100) : [],
  ]);
  return { actor, school, areas: specialistAreas(actor.role), students: studentRows, cases, notes, accessLogs, alerts, restrictions, clinicVisits: visits, senProfiles: profiles, senReviews: reviews };
}

export type SpecialistData = Awaited<ReturnType<typeof getSpecialistData>>;
