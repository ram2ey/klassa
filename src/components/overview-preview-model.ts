import type { OverviewModel } from "./overview-dashboard";

export function overviewPreviewModel(role: "administrator" | "office" | "teacher", empty: boolean): OverviewModel {
  const link = (section: string) => `/design-system/shell?role=${role}&section=${section}`;
  const admin = role === "administrator";
  const teacher = role === "teacher";
  const scope = empty ? "No submitted attendance marks · Synthetic information" : admin ? "All school years · Synthetic submitted and locked sessions · 2026-09-01 to 2026-10-05" : "2026-10-05 · Synthetic permitted morning roll call";
  return {
    description: `Adom Community School · ${empty ? "No current academic year" : "2026–27"} · ${teacher ? "Your teaching workspace" : admin ? "School administration" : "Office operations"}`,
    metrics: [
      { label: "Active pupils", value: empty ? 0 : teacher ? 28 : 412, detail: teacher ? "Unique active pupils in your assigned classes" : "School directory · Active status only", icon: "students", href: link(teacher ? "classes" : "students") },
      { label: teacher ? "Assigned classes" : admin ? "Current-year classes" : "Pending intake", value: empty ? 0 : teacher ? 2 : admin ? 16 : 8, detail: empty ? "No current academic year · Synthetic information" : "2026–27 academic year · Synthetic information", icon: "classes", href: link(teacher || admin ? "classes" : "students") },
      { label: teacher ? "Assessments" : admin ? "Staff" : "Guardian contacts", value: empty ? 0 : teacher ? 6 : admin ? 28 : 530, detail: "Accessible records · Synthetic information", icon: "staff", href: link(teacher ? "gradebook" : admin ? "staff" : "guardians") },
      { label: "Attendance rate", value: empty ? "—" : "94%", detail: empty ? "No submitted attendance marks yet" : admin ? "All school years · 100 synthetic marks" : "2026-10-05 · 100 synthetic marks", icon: "attendance", href: link("attendance") },
    ],
    attendance: { total: empty ? 0 : 100, attended: empty ? 0 : 94, absent: empty ? 0 : 4, scope, href: link("attendance") },
    steps: admin ? [
      { label: "Set the current academic year", description: "Create and select the current year.", done: !empty, href: link("academic") },
      { label: "Add grades and classes", description: "Organize current-year classes.", done: !empty, href: link("classes") },
      { label: "Create staff accounts", description: "Invite teachers and office staff.", done: !empty, href: link("staff") },
      { label: "Enroll your students", description: "Place pupils in current-year classes.", done: !empty, href: link("students") },
      { label: "Link guardian contacts", description: "Connect pupils with their guardians.", done: false, href: link("guardians") },
    ] : undefined,
    tasks: teacher ? undefined : [{ label: "Guardian absence notes awaiting review", count: empty ? 0 : 3, detail: `Pending among the latest ${admin ? 100 : 200} synthetic notes.`, href: link("attendance") }],
    actions: [{ label: "Open attendance", href: link("attendance"), description: "Review submitted sessions and absence notes." }, { label: teacher ? "Open class rosters" : "Manage students", href: link(teacher ? "classes" : "students") }, { label: teacher ? "Open gradebook" : admin ? "Manage staff" : "Open reception desk", href: link(teacher ? "gradebook" : admin ? "staff" : "reception") }],
    activity: admin ? empty ? [] : [
      { id: "1", action: "Student enrolled", actor: "Ama Mensah", timestamp: "5 Oct 2026, 09:12 GMT", dateTime: "2026-10-05T09:12:00Z" },
      { id: "2", action: "Morning roll call submitted", actor: "Kwame Owusu", timestamp: "5 Oct 2026, 08:30 GMT", dateTime: "2026-10-05T08:30:00Z" },
      { id: "3", action: "Class assignment updated", actor: "Ama Mensah", timestamp: "2 Oct 2026, 15:45 GMT", dateTime: "2026-10-02T15:45:00Z" },
    ] : undefined,
    activityHref: admin ? link("audit") : undefined,
    notices: admin ? undefined : empty ? [] : [{ id: "notice", title: "Staff planning meeting", content: "Synthetic notice: review the class schedule ahead of Friday’s meeting." }],
    guidance: empty ? teacher ? "Ask your administrator to assign your current-year classes." : "Start with the academic year and classes, then staff accounts, pupil enrollment and guardian contacts." : undefined,
  };
}
