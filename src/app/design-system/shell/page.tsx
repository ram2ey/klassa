import { notFound } from "next/navigation";
import { WorkspaceShellPreview, type PreviewRole } from "@/components/workspace-shell-preview";

export default async function ShellPreviewPage({ searchParams }: { searchParams: Promise<{ role?: string; section?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const role = ["administrator", "office", "teacher", "guardian"].includes(params.role ?? "") ? params.role as PreviewRole : "administrator";
  return <WorkspaceShellPreview role={role} section={params.section ?? "overview"} />;
}
