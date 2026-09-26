import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GuardianSchoolConsents } from "./guardian-school-consents";

const mocks = vi.hoisted(() => ({ update: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/app/actions/guardian-portal-actions", () => ({ updateGuardianSchoolConsentAction: mocks.update }));

const consent = { guardianId: "guardian-1", schoolId: "school-1", schoolName: "Northfield School",
  guardianName: "Alex Parent", studentNames: ["Ada Lee", "Leo Lee"], mediaConsent: false, excursionConsent: true };

beforeEach(() => { mocks.update.mockReset().mockResolvedValue({ success: true, changed: true, granted: true }); mocks.refresh.mockClear(); });
afterEach(cleanup);

describe("guardian school consent controls", () => {
  it("shows the scope and current choices, then saves a media grant", async () => {
    render(<GuardianSchoolConsents consents={[consent]} />);
    expect(screen.getByText(/Ada Lee, Leo Lee/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Grant media" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Revoke excursions" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Grant media" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({ guardianId: "guardian-1", schoolId: "school-1", kind: "media", granted: true }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(screen.getByRole("status").textContent).toContain("Media consent granted");
  });
  it("shows the server's error when a choice cannot be saved", async () => {
    mocks.update.mockResolvedValue({ success: false, error: "Legal responsibility required." });
    render(<GuardianSchoolConsents consents={[consent]} />);
    fireEvent.click(screen.getByRole("button", { name: "Revoke excursions" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Legal responsibility required.");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
