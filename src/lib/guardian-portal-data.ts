import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, announcements, attendanceRecords, attendanceSessions, classes, enrollments, gradeLevels,
  guardianAbsenceNotes, guardianConsents, guardianInquiries, guardianInquiryMessages, guardians, organizations, reportCardSubjectGrades, reportCards, studentGuardians, students, subjects, terms } from "@/db/schema";
import { requireGuardian } from "@/lib/action-access";

export async function getGuardianPortalData() {
  const account = await requireGuardian();
  const guardianIds = account.guardians.map(guardian => guardian.id);
  const linkedRows = await db.select({ guardianId: studentGuardians.guardianId, studentId: studentGuardians.studentId,
    organizationId: studentGuardians.organizationId, relationship: studentGuardians.relationship })
    .from(studentGuardians).innerJoin(students, and(eq(students.id, studentGuardians.studentId),
      eq(students.organizationId, studentGuardians.organizationId)))
    .where(and(inArray(studentGuardians.guardianId, guardianIds), eq(studentGuardians.hasLegalResponsibility, true)));
  const legalLinks = linkedRows.filter(link => account.guardians.some(profile =>
    profile.id === link.guardianId && profile.organizationId === link.organizationId));
  const studentIds = [...new Set(legalLinks.map(link => link.studentId))];
  if (!studentIds.length) return { guardianName: account.name, students: [], announcements: [], consents: [], inquiries: [] };

  const orgIds = [...new Set(legalLinks.map(link => link.organizationId))];
  const [studentRows, schoolRows, guardianRows, consentRows, yearRows, classRows, gradeRows, termRows, enrollmentRows] = await Promise.all([
    db.select({ id: students.id, organizationId: students.organizationId, firstName: students.firstName,
      preferredName: students.preferredName, lastName: students.lastName, studentNumber: students.studentNumber, status: students.status })
      .from(students).where(inArray(students.id, studentIds)),
    db.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, orgIds)),
    db.select({ id: guardians.id, organizationId: guardians.organizationId, firstName: guardians.firstName, lastName: guardians.lastName })
      .from(guardians).where(inArray(guardians.id, guardianIds)),
    db.select({ guardianId: guardianConsents.guardianId, organizationId: guardianConsents.organizationId,
      mediaConsent: guardianConsents.mediaConsent, excursionConsent: guardianConsents.excursionConsent })
      .from(guardianConsents).where(and(inArray(guardianConsents.guardianId, guardianIds), inArray(guardianConsents.organizationId, orgIds))),
    db.select().from(academicYears).where(and(inArray(academicYears.organizationId, orgIds), eq(academicYears.isCurrent, true))),
    db.select().from(classes).where(inArray(classes.organizationId, orgIds)),
    db.select().from(gradeLevels).where(inArray(gradeLevels.organizationId, orgIds)),
    db.select().from(terms).where(inArray(terms.organizationId, orgIds)),
    db.select().from(enrollments).where(inArray(enrollments.studentId, studentIds)),
  ]);
  const authorizedStudentRows = studentRows.filter(student => legalLinks.some(link => link.studentId === student.id && link.organizationId === student.organizationId));
  const currentYearIds = new Set(yearRows.map(year => year.id));
  const currentPlacements = enrollmentRows.filter(row => currentYearIds.has(row.academicYearId));
  const visibleChildren = authorizedStudentRows.map(student => {
    const school = schoolRows.find(row => row.id === student.organizationId);
    const placement = currentPlacements.find(row => row.studentId === student.id);
    const schoolClass = classRows.find(row => row.id === placement?.classId);
    const grade = gradeRows.find(row => row.id === schoolClass?.gradeLevelId);
    const year = yearRows.find(row => row.id === placement?.academicYearId);
    return { id: student.id, firstName: student.preferredName || student.firstName, lastName: student.lastName,
      studentNumber: student.studentNumber, status: student.status, schoolName: school?.name ?? "School",
      schoolId: student.organizationId, currentYearId: year?.id ?? null, currentYearName: year?.name ?? null,
      className: schoolClass ? `${grade?.name ?? ""} / ${schoolClass.name}` : "Not assigned",
      classIds: schoolClass ? [schoolClass.id] : [], gradeIds: grade ? [grade.id] : [] };
  });

  const attendanceStart = new Date(); attendanceStart.setUTCDate(attendanceStart.getUTCDate() - 120);
  const [attendanceRows, publishedCards, noticeRows, absenceNotes, inquiryRows] = await Promise.all([
    db.select({ studentId: attendanceRecords.studentId, date: attendanceSessions.sessionDate,
      status: attendanceRecords.status, arrivalMinutesLate: attendanceRecords.arrivalMinutesLate })
      .from(attendanceRecords).innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
      .where(and(inArray(attendanceRecords.studentId, studentIds), inArray(attendanceRecords.organizationId, orgIds),
        inArray(attendanceSessions.organizationId, orgIds), gte(attendanceSessions.sessionDate, attendanceStart.toISOString().slice(0, 10)),
        inArray(attendanceSessions.status, ["submitted", "locked"])))
      .orderBy(desc(attendanceSessions.sessionDate)),
    db.select({ id: reportCards.id, studentId: reportCards.studentId, termId: reportCards.termId,
      version: reportCards.version, overallPercentage: reportCards.overallPercentage, gpa: reportCards.gpa,
      publishedAt: reportCards.publishedAt })
      .from(reportCards).where(and(inArray(reportCards.studentId, studentIds), inArray(reportCards.organizationId, orgIds), eq(reportCards.status, "published")))
      .orderBy(desc(reportCards.publishedAt)),
    db.select().from(announcements)
      .where(and(inArray(announcements.organizationId, orgIds), eq(announcements.status, "published")))
      .orderBy(desc(announcements.publishedAt)).limit(300),
    db.select({ id: guardianAbsenceNotes.id, studentId: guardianAbsenceNotes.studentId, absenceDate: guardianAbsenceNotes.absenceDate,
      reasonCategory: guardianAbsenceNotes.reasonCategory, status: guardianAbsenceNotes.status, createdAt: guardianAbsenceNotes.createdAt })
      .from(guardianAbsenceNotes).where(and(inArray(guardianAbsenceNotes.organizationId, orgIds),
        inArray(guardianAbsenceNotes.guardianId, guardianIds), inArray(guardianAbsenceNotes.studentId, studentIds)))
      .orderBy(desc(guardianAbsenceNotes.createdAt)),
    db.select().from(guardianInquiries).where(and(inArray(guardianInquiries.organizationId, orgIds),
      inArray(guardianInquiries.guardianId, guardianIds)))
      .orderBy(desc(guardianInquiries.updatedAt), desc(guardianInquiries.createdAt)),
  ]);
  const publishedSubjects = publishedCards.length ? await db.select({ reportCardId: reportCardSubjectGrades.reportCardId,
    subjectName: subjects.name, scorePercentage: reportCardSubjectGrades.scorePercentage,
    letterGrade: reportCardSubjectGrades.letterGrade, comments: reportCardSubjectGrades.comments })
    .from(reportCardSubjectGrades).innerJoin(subjects, eq(subjects.id, reportCardSubjectGrades.subjectId))
    .where(and(inArray(reportCardSubjectGrades.reportCardId, publishedCards.map(card => card.id)), inArray(reportCardSubjectGrades.organizationId, orgIds))) : [];

  const studentsWithDetails = visibleChildren.map(child => {
    const cards = publishedCards.filter(card => card.studentId === child.id).map(card => ({ ...card,
      termName: termRows.find(term => term.id === card.termId)?.name ?? "Term",
      subjects: publishedSubjects.filter(subject => subject.reportCardId === card.id) }));
    const attendance = attendanceRows.filter(row => row.studentId === child.id).slice(0, 30);
    const attendedCount = attendance.filter(row => row.status === "present" || row.status === "late").length;
    return { ...child, attendance, attendanceRate: attendance.length ? Math.round(attendedCount / attendance.length * 100) : null, reports: cards,
      absenceNotes: absenceNotes.filter(note => note.studentId === child.id) };
  });

  const visibleNotices = noticeRows.filter(notice => notice.channels !== "sms" && studentsWithDetails.some(child => {
    if (notice.organizationId !== child.schoolId) return false;
    if (notice.targetType === "school") return true;
    if (notice.targetType === "class") return child.classIds.includes(notice.targetId);
    if (notice.targetType === "grade") return child.gradeIds.includes(notice.targetId);
    return false;
  })).map(notice => ({ id: notice.id, title: notice.title, content: notice.content, priority: notice.priority,
    publishedAt: notice.publishedAt, schoolName: schoolRows.find(school => school.id === notice.organizationId)?.name ?? "School" }));

  const consentProfiles = [...new Map(legalLinks.map(link => [`${link.organizationId}:${link.guardianId}`, link])).values()];
  const consents = consentProfiles.map(profile => {
    const consent = consentRows.find(row => row.guardianId === profile.guardianId && row.organizationId === profile.organizationId);
    const guardian = guardianRows.find(row => row.id === profile.guardianId && row.organizationId === profile.organizationId);
    const coveredIds = new Set(legalLinks.filter(link => link.guardianId === profile.guardianId && link.organizationId === profile.organizationId)
      .map(link => link.studentId));
    return { guardianId: profile.guardianId, schoolId: profile.organizationId,
      schoolName: schoolRows.find(school => school.id === profile.organizationId)?.name ?? "School",
      guardianName: guardian ? `${guardian.firstName} ${guardian.lastName}` : account.name,
      studentNames: studentsWithDetails.filter(child => coveredIds.has(child.id) && child.schoolId === profile.organizationId)
        .map(child => `${child.firstName} ${child.lastName}`),
      mediaConsent: consent?.mediaConsent ?? false, excursionConsent: consent?.excursionConsent ?? false };
  });

  const inquiryIds = inquiryRows.map(row => row.id);
  const inquiryMessages = inquiryIds.length ? await db.select().from(guardianInquiryMessages)
    .where(and(inArray(guardianInquiryMessages.organizationId, orgIds), inArray(guardianInquiryMessages.inquiryId, inquiryIds)))
    .orderBy(guardianInquiryMessages.createdAt) : [];

  const serializedInquiries = inquiryRows.map(row => {
    const student = authorizedStudentRows.find(s => s.id === row.studentId);
    const school = schoolRows.find(s => s.id === row.organizationId);
    return {
      id: row.id,
      studentId: row.studentId,
      studentName: student ? `${student.preferredName || student.firstName} ${student.lastName}` : "Student",
      schoolId: row.organizationId,
      schoolName: school?.name ?? "School",
      targetRole: row.targetRole,
      title: row.title,
      category: row.category as "academic" | "pastoral" | "attendance" | "general",
      status: row.status,
      closedAt: row.closedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      messages: inquiryMessages.filter(m => m.inquiryId === row.id).map(m => ({
        id: m.id,
        senderType: m.senderType,
        senderName: m.senderName,
        message: m.message,
        createdAt: m.createdAt,
      })),
    };
  });

  return { guardianName: account.name, students: studentsWithDetails, announcements: visibleNotices, consents, inquiries: serializedInquiries };
}

export type GuardianPortalData = Awaited<ReturnType<typeof getGuardianPortalData>>;
