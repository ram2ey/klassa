import { getPlatformInvitationData } from "@/lib/school-invitations";
import { isDemoMode } from "@/lib/runtime-config";
import { getAuth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PlatformInvitations } from "@/components/platform-invitations";
import { getLiveSystemHealthReport } from "@/lib/live-health";

export const dynamic = "force-dynamic";

export default async function PlatformPage() {
  if (isDemoMode()) return <main className="mx-auto max-w-xl space-y-3 p-6"><h1 className="text-xl font-bold">Platform administration</h1>
    <p>Real school invitations are unavailable in the local demo. Connect PostgreSQL, disable demo mode and sign in with your platform administrator account.</p></main>;
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!session.user.twoFactorEnabled) redirect("/setup-mfa");
  if (!session.user.isPlatformAdmin) return <main className="p-6">Platform administrator access required.</main>;
  const data = await getPlatformInvitationData();
  return <PlatformInvitations data={data} health={await getLiveSystemHealthReport()} />;
}
