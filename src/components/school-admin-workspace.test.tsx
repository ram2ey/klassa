import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SchoolAdminData } from "@/lib/school-admin-data";
import { SchoolAdminWorkspace } from "./school-admin-workspace";

const mocks = vi.hoisted(() => ({ save: vi.fn(), provision: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/components/account-sign-out", () => ({ AccountSignOut: () => <button>Sign out</button> }));
vi.mock("@/app/actions/school-admin-actions", () => ({ saveSchoolRecordAction: mocks.save }));
vi.mock("@/app/actions/school-access-actions", () => ({ provisionStaffForCurrentSchoolAction: mocks.provision }));

const data: SchoolAdminData = {
  school: { id: "school-1", name: "Northfield School", slug: "northfield", timezone: "Atlantic/Reykjavik" },
  actor: { organizationId: "school-1", userId: "admin-1", name: "School Admin", role: "school_admin" },
  students: [], guardians: [], links: [], staff: [], classes: [], grades: [], years: [], terms: [], subjects: [], enrollments: [], audit: [],
};

beforeEach(() => {
  mocks.save.mockReset().mockResolvedValue({ success: true, entityId: "saved-record" });
  mocks.provision.mockReset(); mocks.refresh.mockClear();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
});
afterEach(cleanup);

describe("school administration workspace", () => {
  it.each([
    ["overview", "Overview"], ["students", "Students"], ["guardians", "Guardians"],
    ["staff", "Staff & access"], ["classes", "Classes & grades"], ["subjects", "Subjects"],
    ["academic", "Academic years"], ["audit", "Audit history"], ["settings", "School settings"],
  ])("opens the %s section with the actual school identity", (section, title) => {
    render(<SchoolAdminWorkspace data={data} section={section} />);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeTruthy();
    expect(screen.getAllByText("Northfield School").length).toBeGreaterThan(0);
    expect(screen.queryByText("Olivia Parker")).toBeNull();
  });
  it("prevents enrollment until school setup supplies a current class", () => {
    render(<SchoolAdminWorkspace data={data} section="students" />);
    fireEvent.click(screen.getByRole("button", { name: "Enroll student" }));
    expect((screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Add the required school records first, then return to this form.")).toBeTruthy();
  });
  it("saves a guardian without requiring a phone number and refreshes live data", async () => {
    render(<SchoolAdminWorkspace data={data} section="guardians" />);
    fireEvent.click(screen.getByRole("button", { name: "Add guardian" }));
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Smith" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ kind: "guardian", firstName: "Alex", lastName: "Smith", email: "", phone: "" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("keeps the form and entered values when the server rejects a save", async () => {
    mocks.save.mockResolvedValue({ success: false, error: "Subject code is already in use." });
    render(<SchoolAdminWorkspace data={data} section="subjects" />);
    fireEvent.click(screen.getByRole("button", { name: "Add subject" }));
    fireEvent.change(screen.getByLabelText("Subject code"), { target: { value: "MATH" } });
    fireEvent.change(screen.getByLabelText("Subject name"), { target: { value: "Mathematics" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Subject code is already in use.");
    expect(screen.getByLabelText("Subject name")).toHaveProperty("value", "Mathematics");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
