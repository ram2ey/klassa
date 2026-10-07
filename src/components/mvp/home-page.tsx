import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { isDemoMode } from "@/lib/runtime-config";
import { requireAccount, requireStaff } from "@/lib/action-access";
import { getMvpData } from "@/lib/mvp-data";
import { canonicalMvpLocation } from "@/lib/mvp-policy";
import { MvpWorkspace } from "@/components/mvp/workspace";
import { SchoolAdminWorkspace } from "@/components/school-admin-workspace";
import { OfficeWorkspace } from "@/components/office-workspace";
import { getSchoolAdminData } from "@/lib/school-admin-data";
import { getOfficeData } from "@/lib/office-data";
import { MvpDemo } from "@/components/mvp/demo";

export default async function Home({ searchParams }: { searchParams: Promise<{ section?: string; tab?: string; date?: string }> }) {
  const query = await searchParams;
  const location = canonicalMvpLocation(query.section, query.tab);
  if (query.section && (location.section !== query.section || (query.tab ?? "") !== location.tab)) {
    redirect(`/?section=${location.section}${location.tab ? `&tab=${location.tab}` : ""}`);
  }
  const date = query.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date) ? query.date : new Date().toISOString().slice(0, 10);
  if (isDemoMode()) return <MvpDemo section={location.section} tab={location.tab} date={date} />;
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");
  if (session.user.isPlatformAdmin && !session.user.twoFactorEnabled) redirect("/setup-mfa");
  const { user, session: accountSession } = await requireAccount();
  if (user.isPlatformAdmin && !user.twoFactorEnabled) redirect("/setup-mfa");
  if (user.isPlatformAdmin) redirect("/platform");
  if (!accountSession.session.activeOrganizationId && !user.organizationId) redirect("/schools");
  const actor = await requireStaff(["school_admin", "office_staff", "teacher"]);
  if ((actor.role === "teacher" && ["fees", "settings"].includes(location.section)) || (actor.role === "office_staff" && ["marks", "settings"].includes(location.section))) redirect("/");
  const data = await getMvpData(actor, location.section, date);
  let content: React.ReactNode;
  if (actor.role === "school_admin" && ["students", "settings"].includes(location.section)) {
    const legacy = location.section === "students" ? location.tab === "contacts" ? "guardians" : "students"
      : ["staff", "classes", "subjects", "academic", "audit"].includes(location.tab) ? location.tab : "settings";
    content = <SchoolAdminWorkspace key={legacy} embedded data={await getSchoolAdminData(true)} section={legacy} date={date} />;
  } else if (actor.role === "office_staff" && location.section === "students") {
    const legacy = location.tab === "contacts" ? "guardians" : "students";
    content = <OfficeWorkspace key={legacy} embedded data={await getOfficeData(date, true)} notices={[]} section={legacy} date={date} />;
  }
  return <MvpWorkspace key={`${location.section}:${location.tab}`} data={data} section={location.section} tab={location.tab} date={date}>{content}</MvpWorkspace>;
}
