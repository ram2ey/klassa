"use client";
import { useEffect, useState, type ReactNode } from "react";
import { WorkspaceShell } from "./workspace-shell";
import { guardianNavigation } from "./workspace-navigation";

export function GuardianWorkspaceShell({ guardianName, schoolName, academicYear, hasStudents, children }: { guardianName: string; schoolName: string; academicYear?: string; hasStudents: boolean; children: ReactNode }) {
  const [active, setActive] = useState("students");
  useEffect(() => {
    const update = () => setActive(window.location.hash === "#guardian-notices" ? "notices" : window.location.hash === "#guardian-preferences" ? "preferences" : "students");
    update(); window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  return <WorkspaceShell schoolName={schoolName} academicYear={academicYear} actorName={guardianName} roleLabel="Parent / Guardian" navigationLabel="Family navigation" contentId="guardian-content" activeId={active} onNavigate={setActive} groups={guardianNavigation(hasStudents)}>{children}</WorkspaceShell>;
}
