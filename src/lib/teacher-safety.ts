import { sanitizeTeacherAlert } from "@/lib/sensitive-records";

type Alert = {
  id: string;
  studentId: string;
  category: string;
  severity: "routine" | "urgent" | "critical";
  directiveSummary: string;
  actionRequired: string;
  isActive: boolean;
  expiresAt: Date | null;
};

type Restriction = {
  studentId: string;
  prohibitPickup: boolean;
  isEnforced: boolean;
  effectiveDate: string;
  expirationDate: string | null;
};

export function buildTeacherSafetyNotices(studentIds: string[], alerts: Alert[], restrictions: Restriction[], now = new Date()) {
  const assignedStudents = new Set(studentIds);
  const today = now.toISOString().slice(0, 10);
  return {
    alerts: alerts.filter(alert => assignedStudents.has(alert.studentId) && alert.isActive &&
      (!alert.expiresAt || alert.expiresAt > now)).map(alert => {
      const safe = sanitizeTeacherAlert(alert.directiveSummary, alert.actionRequired);
      return { id: alert.id, studentId: alert.studentId, category: alert.category, severity: alert.severity,
        directiveSummary: safe.directiveSummary, actionRequired: safe.actionRequired };
    }),
    pickupWarnings: [...new Set(restrictions.filter(restriction => assignedStudents.has(restriction.studentId) &&
      restriction.isEnforced && restriction.prohibitPickup && restriction.effectiveDate <= today &&
      (!restriction.expirationDate || restriction.expirationDate >= today)).map(restriction => restriction.studentId))],
  };
}
