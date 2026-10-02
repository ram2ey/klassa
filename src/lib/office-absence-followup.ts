type Session = { id: string; classId: string; sessionDate: string; period: string; status: string };
type Record = { studentId: string; sessionId: string; status: string };
type Note = { studentId: string; absenceDate: string };
type Link = { studentId: string; guardianId: string; isPrimary: boolean; hasLegalResponsibility: boolean };
type Guardian = { id: string; firstName: string; lastName: string; phone: string | null; email: string | null };
type Restriction = { studentId: string; restrictedGuardianId: string | null; isEnforced: boolean;
  prohibitDirectContact: boolean; prohibitDisclosure: boolean; effectiveDate: string; expirationDate: string | null };

export function buildUnexplainedAbsenceCallList(sessions: Session[], records: Record[], notes: Note[], links: Link[], guardians: Guardian[], restrictions: Restriction[], today: string) {
  const morningSessions = new Map(sessions.filter(session => session.period === "morning_roll_call" &&
    (session.status === "submitted" || session.status === "locked")).map(session => [session.id, session]));
  const noted = new Set(notes.map(note => `${note.studentId}:${note.absenceDate}`));
  const seen = new Set<string>();
  return records.flatMap(record => {
    const session = morningSessions.get(record.sessionId);
    if (!session || record.status !== "absent" || noted.has(`${record.studentId}:${session.sessionDate}`) || seen.has(record.studentId)) return [];
    seen.add(record.studentId);
    const contacts = links.filter(link => link.studentId === record.studentId && link.hasLegalResponsibility).map(link => ({ ...link,
      guardian: guardians.find(guardian => guardian.id === link.guardianId) })).filter(link => !!link.guardian);
    const allowed = contacts.filter(link => !restrictions.some(order => order.studentId === record.studentId &&
      (!order.restrictedGuardianId || order.restrictedGuardianId === link.guardianId) && order.isEnforced &&
      (order.prohibitDirectContact || order.prohibitDisclosure) && order.effectiveDate <= today &&
      (!order.expirationDate || order.expirationDate >= today)));
    const contact = allowed.find(link => link.isPrimary && link.guardian?.phone) ??
      allowed.find(link => !!link.guardian?.phone) ?? allowed.find(link => link.isPrimary) ?? allowed[0];
    return [{ studentId: record.studentId, classId: session.classId, sessionDate: session.sessionDate,
      guardianName: contact?.guardian ? `${contact.guardian.firstName} ${contact.guardian.lastName}` : null,
      phone: contact?.guardian?.phone ?? null, email: contact?.guardian?.email ?? null,
      contactBlocked: contacts.length > 0 && allowed.length === 0 }];
  });
}
