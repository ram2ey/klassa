"use client";
import { DirectoryPreview } from "./directory-preview";
import { useState } from "react";
import { OverviewDashboard } from "./overview-dashboard";
import { overviewPreviewModel } from "./overview-preview-model";
import { Button } from "./ui/button";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "./workspace-shell";
import { groupWorkspaceNavigation, guardianNavigation, officeNavigationItems, teacherNavigationItems } from "./workspace-navigation";
import { sections } from "./school-admin/shared";
import { Card, CardContent, CardHeader, PageHeading } from "./ui/card";
import { Field, Select } from "./ui/field";
import { EmptyState } from "./ui/states";

export type PreviewRole = "administrator" | "office" | "teacher" | "guardian";
const roles = { administrator: "School administrator", office: "Office staff", teacher: "Teacher", guardian: "Parent / Guardian" };

export function WorkspaceShellPreview({ role, section }: { role: PreviewRole; section: string }) {
  const router = useRouter();
  const [empty, setEmpty] = useState(false);
  const groups = role === "guardian" ? guardianNavigation(true) : groupWorkspaceNavigation(role === "administrator" ? sections : role === "office" ? officeNavigationItems : teacherNavigationItems);
  const current = groups.flatMap(group => group.items).find(item => item.id === section) ?? groups[0].items[0];
  const previewGroups = groups.map(group => ({ ...group, items: group.items.map(item => ({ ...item, href: `/design-system/shell?role=${role}&section=${item.id}` })) }));
  return <WorkspaceShell schoolName="Adom Community School" academicYear={empty ? "Academic year not set" : "2026–27 Academic Year"} actorName="Ama Mensah" roleLabel={roles[role]} navigationLabel={`${roles[role]} navigation`} groups={previewGroups} activeId={current.id} contentId="shell-preview-content" accountActions={<p className="p-2 text-xs text-secondary">Synthetic preview account</p>} banner={<div role="status" className="bg-warning-subtle px-4 py-2 text-center text-xs text-warning">Development shell preview · Synthetic information only</div>} toolbar={<div className="w-full max-w-sm"><Field label="Preview role"><Select value={role} onChange={event => router.push(`/design-system/shell?role=${event.target.value}&section=overview`)}>{Object.entries(roles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field></div>}>
    {current.id === "overview" && role !== "guardian" ? <OverviewDashboard model={overviewPreviewModel(role, empty)} headingAction={<Button variant="secondary" onClick={() => setEmpty(value => !value)}>{empty ? "Show sample data" : "Show empty school"}</Button>} /> : ["administrator", "office"].includes(role) && (current.id === "students" || current.id === "guardians") ? <DirectoryPreview key={current.id} section={current.id} office={role === "office"} /> : <>
    <PageHeading title={current.label} description="Shared navigation, account controls and responsive page structure." />
    <Card><CardHeader title="Phase 2 workspace shell" description="The navigation entries come from the same role configuration used by the live workspaces." /><CardContent><p className="text-sm text-secondary">Collapse the desktop sidebar, select a section, open the account menu or narrow the window to test the mobile navigation drawer.</p></CardContent></Card>
    <Card><EmptyState title="Your workspace content appears here" description="This preview demonstrates the shell. Individual page redesigns follow in later phases." /></Card>
    </>}
  </WorkspaceShell>;
}
