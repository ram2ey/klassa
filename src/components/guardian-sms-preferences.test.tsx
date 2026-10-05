import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GuardianSmsPreferences } from "./guardian-sms-preferences";

const mocks = vi.hoisted(() => ({ own: vi.fn(), staff: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/app/actions/guardian-portal-actions", () => ({ updateGuardianSmsPreferencesAction: mocks.own }));
vi.mock("@/app/actions/guardian-sms-preferences-actions", () => ({ recordGuardianSmsPreferencesAction: mocks.staff }));
const profiles = [{ guardianId: "guardian-a", schoolId: "school-a", label: "School A", announcements: true },
  { guardianId: "guardian-b", schoolId: "school-b", label: "School B", announcements: false }];
beforeEach(() => { vi.clearAllMocks(); mocks.own.mockResolvedValue({ success: true }); mocks.staff.mockResolvedValue({ success: true }); });
afterEach(cleanup);
describe("live SMS preferences", () => {
  it("loads each school's choice and submits an opt-out for the selected profile", async () => {
    render(<GuardianSmsPreferences profiles={profiles} />);
    fireEvent.click(screen.getByLabelText("Receive school announcement SMS"));
    fireEvent.click(screen.getByRole("button", { name: "Save SMS preferences" }));
    await waitFor(() => expect(mocks.own).toHaveBeenCalledWith({ guardianId: "guardian-a", schoolId: "school-a", announcements: false }));
    expect((await screen.findByRole("status")).textContent).toBe("SMS preferences saved.");
    fireEvent.change(screen.getByLabelText("School contact"), { target: { value: "guardian-b" } });
    expect((screen.getByLabelText("Receive school announcement SMS") as HTMLInputElement).checked).toBe(false);
    expect(mocks.refresh).toHaveBeenCalled();
  });
  it("records staff confirmation and surfaces save failures", async () => {
    mocks.staff.mockResolvedValue({ success: false, error: "Guardian profile unavailable" });
    render(<GuardianSmsPreferences staff profiles={profiles} />);
    fireEvent.change(screen.getByLabelText("Guardian confirmation"), { target: { value: "Requested by phone today" } });
    fireEvent.click(screen.getByRole("button", { name: "Save SMS preferences" }));
    await waitFor(() => expect(mocks.staff).toHaveBeenCalledWith({ guardianId: "guardian-a", announcements: true, evidence: "Requested by phone today" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Guardian profile unavailable");
    expect(mocks.own).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
