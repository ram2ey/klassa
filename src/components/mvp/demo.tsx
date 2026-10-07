import { MvpWorkspace } from "./workspace";
import type { MvpData } from "@/lib/mvp-data";

/** Synthetic display only. Live mode is required for every MVP write. */
export function MvpDemo({ section, tab, date }: { section: string; tab: string; date: string }) {
  const year = date.slice(0, 4);
  const stamp = new Date(`${year}-01-01T00:00:00Z`);
  const school = "00000000-0000-4000-8000-000000000001";
  const classId = "00000000-0000-4000-8000-000000000002";
  const termId = "00000000-0000-4000-8000-000000000003";
  const subjectId = "00000000-0000-4000-8000-000000000004";
  const pupilId = "00000000-0000-4000-8000-000000000005";
  const yearId = "00000000-0000-4000-8000-000000000006";
  const data = {
    school: { id: school, name: "Example School", slug: "example" }, actor: { organizationId: school, userId: "demo", name: "Demo administrator", role: "school_admin" },
    currentYear: { id: yearId, organizationId: school, name: `${year} academic year`, startsOn: `${year}-01-01`, endsOn: `${year}-12-31`, isCurrent: true, createdAt: stamp, updatedAt: stamp },
    classes: [{ id: classId, organizationId: school, academicYearId: yearId, gradeLevelId: "demo", name: "Basic 4 A", homeroomTeacherId: "demo", createdAt: stamp, updatedAt: stamp }],
    terms: [{ id: termId, organizationId: school, academicYearId: yearId, name: "Pilot term", startsOn: `${year}-01-01`, endsOn: `${year}-12-31`, position: 1, isLocked: false, lockedAt: null, lockedById: null, lockNotes: null, classworkWeight: 40, createdAt: stamp, updatedAt: stamp }],
    subjects: [{ id: subjectId, organizationId: school, code: "MATH", name: "Mathematics", department: null, createdAt: stamp, updatedAt: stamp }],
    classSubjects: [{ id: "demo-subject", organizationId: school, classId, subjectId }], homeroomIds: [classId],
    pupils: [{ id: pupilId, studentNumber: "ST-000001", firstName: "Ama", lastName: "Mensah", status: "active", classId }],
    sessions: [], records: [], marks: [{ id: "demo-mark", organizationId: school, classId, studentId: pupilId, termId, subjectId, classworkScore: "80.00", examScore: "75.00", remark: "Good progress", updatedBy: "demo", createdAt: stamp, updatedAt: stamp }],
    reports: [], definitions: [], entries: [], payments: [], balances: [{ studentId: pupilId, amountPesewas: 45000 }], restrictions: [],
  } satisfies MvpData;
  return <><p className="border-b border-line bg-surface-subtle px-5 py-3 text-sm">Synthetic MVP preview. Disable demo mode and connect a migrated database to enrol pupils, save records or print receipts.</p><MvpWorkspace data={data} section={section} tab={tab} date={date}>
    {section === "students" && <section className="ui-card p-5"><h2 className="font-semibold">Example pupil</h2><p className="mt-3">Ama Mensah · ST-000001 · Basic 4 A</p><p className="mt-2 text-sm text-secondary">Live mode provides enrolment, guardian contacts and CSV import.</p></section>}
    {section === "settings" && <p className="ui-card p-5 text-sm">Live mode provides school details, staff accounts, classes, subjects, years, terms and audited year placement.</p>}
  </MvpWorkspace></>;
}
