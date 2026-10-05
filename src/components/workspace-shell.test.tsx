import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { WorkspaceShell, type WorkspaceNavGroup } from "./workspace-shell";
import { groupWorkspaceNavigation, guardianNavigation } from "./workspace-navigation";
import { GraduationCap, LayoutDashboard } from "lucide-react";

vi.mock("@/components/account-sign-out", () => ({ AccountSignOut: () => <button>Sign out</button> }));

afterEach(cleanup);
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: vi.fn(function (this: HTMLDialogElement) { this.setAttribute("open", ""); }) });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: vi.fn(function (this: HTMLDialogElement) { this.removeAttribute("open"); }) });
});

const groups: WorkspaceNavGroup[] = [{ label: "Overview", items: [{ id: "overview", label: "Overview", icon: <LayoutDashboard />, href: "/?section=overview" }] }, { label: "People", items: [{ id: "students", label: "Students", icon: <GraduationCap />, href: "/?section=students" }] }];
function Shell({ onNavigate = vi.fn() }: { onNavigate?: (id: string) => void }) {
  return <WorkspaceShell schoolName="School A" academicYear="2026–27" actorName="Office user" roleLabel="Office staff" navigationLabel="Office navigation" groups={groups} activeId="students" contentId="test-content" onNavigate={onNavigate} switchSchoolHref="/schools"><h1>Student directory</h1></WorkspaceShell>;
}

describe("workspace shell", () => {
  it("preserves section URLs and active-page semantics while collapsed", () => {
    render(<Shell />);
    const nav = screen.getByRole("navigation", { name: "Office navigation" });
    expect(within(nav).getByRole("link", { name: "Students" }).getAttribute("href")).toBe("/?section=students");
    expect(within(nav).getByRole("link", { name: "Students" }).getAttribute("aria-current")).toBe("page");
    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    toggle.focus(); fireEvent.click(toggle);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(within(nav).getByRole("link", { name: "Students" }).getAttribute("title")).toBe("Students");
    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#test-content");
    expect(screen.getAllByRole("main")).toHaveLength(1);
  });

  it("closes mobile navigation after selecting a section and calls workspace cleanup", () => {
    const navigate = vi.fn();
    render(<Shell onNavigate={navigate} />);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const drawer = screen.getByRole("dialog", { name: "Navigation" });
    const link = within(drawer).getByRole("link", { name: "Students" });
    link.addEventListener("click", event => event.preventDefault());
    fireEvent.click(link);
    expect(navigate).toHaveBeenCalledWith("students");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Open navigation" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("closes the drawer on a native cancel event", () => {
    render(<Shell />);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("groups only the permitted entries supplied by a role and keeps their original routes", () => {
    const grouped = groupWorkspaceNavigation([{ id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "attendance", label: "Attendance", icon: GraduationCap }]);
    expect(grouped.map(group => group.label)).toEqual(["Overview", "Academics"]);
    expect(grouped.flatMap(group => group.items.map(item => item.href))).toEqual(["/?section=overview", "/?section=attendance"]);
    expect(grouped.flatMap(group => group.items).some(item => item.id === "staff")).toBe(false);
  });

  it("keeps the guardian portal limited to existing family sections and omits unavailable notices", () => {
    render(<WorkspaceShell schoolName="Family portal" actorName="Guardian" roleLabel="Parent / Guardian" navigationLabel="Family navigation" groups={guardianNavigation(false)} activeId="students" contentId="family-content"><h1>Your students</h1></WorkspaceShell>);
    const nav = screen.getByRole("navigation", { name: "Family navigation" });
    expect(within(nav).getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["#guardian-students", "#guardian-preferences"]);
    expect(screen.queryByRole("link", { name: "Switch school" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Staff & access" })).toBeNull();
  });
});
