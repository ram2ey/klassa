import { Award, BookOpen, CalendarCheck, ClipboardList, DoorOpen, GraduationCap, LayoutDashboard, Megaphone, Radio, Settings, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import type { WorkspaceNavGroup } from "./workspace-shell";

const categories: Record<string, string> = {
  overview: "Overview", students: "People", guardians: "People", staff: "People", imports: "People",
  classes: "Academics", subjects: "Academics", academic: "Academics", attendance: "Academics", gradebook: "Academics", reports: "Academics", behaviour: "Academics",
  communications: "Communications", notices: "Communications", broadcast: "Communications",
  sensitive: "Administration", reception: "Administration", audit: "Administration", settings: "Administration",
};

/** Only groups the supplied role-specific entries; it never adds permissions or routes. */
export function groupWorkspaceNavigation(items: readonly { id: string; label: string; icon: React.ComponentType<{ size?: number }> }[]): WorkspaceNavGroup[] {
  const groups = ["Overview", "People", "Academics", "Communications", "Administration"];
  return groups.map(label => ({ label, items: items.filter(item => (categories[item.id] ?? "Administration") === label).map(item => {
    const Icon = item.icon;
    return { id: item.id, label: item.label, href: `/?section=${item.id}`, icon: <Icon size={20} /> as ReactNode };
  }) })).filter(group => group.items.length > 0);
}

export function guardianNavigation(hasStudents: boolean): WorkspaceNavGroup[] {
  return [{ label: "Family portal", items: [
    { id: "students", label: "Your students", href: "#guardian-students", icon: <GraduationCap size={20} /> },
    ...(hasStudents ? [{ id: "notices", label: "School notices", href: "#guardian-notices", icon: <Megaphone size={20} /> }] : []),
    { id: "preferences", label: "SMS preferences", href: "#guardian-preferences", icon: <Settings size={20} /> },
  ] }];
}

export const officeNavigationItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "students", label: "Students", icon: GraduationCap },
  { id: "guardians", label: "Guardians", icon: UsersRound },
  { id: "attendance", label: "Attendance follow-up", icon: CalendarCheck },
  { id: "reception", label: "Reception desk", icon: DoorOpen },
  { id: "broadcast", label: "Parent SMS", icon: Radio },
  { id: "imports", label: "CSV imports", icon: ClipboardList },
  { id: "notices", label: "Notices", icon: Megaphone },
] as const;

export const teacherNavigationItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "classes", label: "My classes", icon: GraduationCap },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "gradebook", label: "Gradebook", icon: BookOpen },
  { id: "reports", label: "Report cards", icon: ClipboardList },
  { id: "behaviour", label: "Behaviour & praise", icon: Award },
  { id: "notices", label: "Notices", icon: Megaphone },
] as const;
