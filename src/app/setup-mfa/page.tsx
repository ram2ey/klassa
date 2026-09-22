import { getAuth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MfaSetup } from "@/components/mfa-setup";

export default async function SetupMfaPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.twoFactorEnabled) redirect("/");
  return <MfaSetup />;
}
