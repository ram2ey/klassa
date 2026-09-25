import { KlassoWorkspace } from "@/components/klasso-workspace";
import { isDemoMode } from "@/lib/runtime-config";
import { getWorkspaceData } from "@/app/actions/roster-actions";
import { listLiveStudents } from "@/lib/live-roster";
import { LiveRoster } from "@/components/live-roster";
import { getAuth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/action-access";
import Link from "next/link";
import { AccountSignOut } from "@/components/account-sign-out";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (isDemoMode()) return <KlassoWorkspace roster={await getWorkspaceData()} />;
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");
  if (session.user.isPlatformAdmin && !session.user.twoFactorEnabled) redirect("/setup-mfa");
  if (session.user.isPlatformAdmin) redirect("/platform");
  if (!session.session.activeOrganizationId && !session.user.organizationId) redirect("/schools");
  const actor = await requireStaff(["school_admin", "office_staff", "teacher", "safeguarding_lead", "senco", "health_nurse"]);
  if (actor.role !== "school_admin" && actor.role !== "office_staff") {
    return <main className="mx-auto max-w-xl space-y-4 p-6"><h1 className="text-xl font-bold">Your school account is ready</h1>
      <p>Your membership is active. Live workflows for your role are still being connected.</p>
      <Link href="/schools" className="text-blue-700 underline">Choose another school</Link><AccountSignOut /></main>;
  }
  return <LiveRoster students={await listLiveStudents()} canManageStaff={actor.role === "school_admin"} />;
}
