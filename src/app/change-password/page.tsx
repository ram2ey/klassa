import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ChangeTemporaryPassword } from "@/components/change-temporary-password";
import { getAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Change temporary password · Klassa", robots: { index: false, follow: false } };

export default async function ChangePasswordPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!session.user.mustChangePassword) redirect("/");
  return <ChangeTemporaryPassword />;
}
