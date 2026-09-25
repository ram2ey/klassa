import { KlassoWorkspace } from "@/components/klasso-workspace";
import { isDemoMode } from "@/lib/runtime-config";
import { getWorkspaceData } from "@/app/actions/roster-actions";
import { getAuth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/action-access";
import Link from "next/link";
import { AccountSignOut } from "@/components/account-sign-out";
import { SchoolAdminWorkspace } from "@/components/school-admin-workspace";
import { getSchoolAdminData } from "@/lib/school-admin-data";
import { getSchoolWorkflowData } from "@/lib/school-workflow-data";
import { getStaffAnnouncements } from "@/lib/school-announcements";
import { SchoolNoticeBoard } from "@/components/school-notice-board";
import { getTeacherData } from "@/lib/teacher-data";
import { TeacherWorkspace } from "@/components/teacher-workspace";
import { getOfficeData } from "@/lib/office-data";
import { OfficeWorkspace } from "@/components/office-workspace";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ section?: string; date?: string }> }) {
  if (isDemoMode()) return <KlassoWorkspace roster={await getWorkspaceData()} />;
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");
  if (session.user.isPlatformAdmin && !session.user.twoFactorEnabled) redirect("/setup-mfa");
  if (session.user.isPlatformAdmin) redirect("/platform");
  if (!session.session.activeOrganizationId && !session.user.organizationId) redirect("/schools");
  const actor = await requireStaff(["school_admin", "office_staff", "teacher", "safeguarding_lead", "senco", "health_nurse"]);
  if (actor.role === "school_admin") {
    const { section, date } = await searchParams;
    const selected = section ?? "overview";
    const selectedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
    const [data, workflow] = await Promise.all([getSchoolAdminData(), getSchoolWorkflowData(selected, selectedDate)]);
    return <SchoolAdminWorkspace key={data.school.id} data={data} workflow={workflow} section={selected} date={selectedDate} />;
  }
  if (actor.role === "teacher") {
    const { section, date } = await searchParams;
    const selected = section ?? "overview";
    const selectedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
    const [data, notices] = await Promise.all([getTeacherData(selected, selectedDate), getStaffAnnouncements()]);
    return <TeacherWorkspace key={data.school.id} data={data} notices={notices} section={selected} date={selectedDate} />;
  }
  if (actor.role === "office_staff") {
    const { section, date } = await searchParams;
    const selected = section ?? "overview";
    const selectedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
    const [data, notices] = await Promise.all([getOfficeData(selectedDate), getStaffAnnouncements()]);
    return <OfficeWorkspace key={data.school.id} data={data} notices={notices} section={selected} date={selectedDate} />;
  }
  return <><main className="mx-auto max-w-xl space-y-4 p-6"><h1 className="text-xl font-bold">Your school account is ready</h1>
      <p>Your membership is active. Live workflows for your role are still being connected.</p>
      <Link href="/schools" className="text-blue-700 underline">Choose another school</Link><AccountSignOut /></main><SchoolNoticeBoard notices={await getStaffAnnouncements()} /></>;
}
