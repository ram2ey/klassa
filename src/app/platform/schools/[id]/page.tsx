import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { getPlatformSchoolDetailData } from "@/lib/platform-school-data";
import { PlatformSchoolDetail } from "@/components/platform-school-detail";

export const dynamic = "force-dynamic";

export default async function PlatformSchoolPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");
  if (!session.user.isPlatformAdmin) redirect("/");
  if (!session.user.twoFactorEnabled) redirect("/setup-mfa");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const data = await getPlatformSchoolDetailData(id);
  if (!data) notFound();
  return <PlatformSchoolDetail data={data} />;
}
