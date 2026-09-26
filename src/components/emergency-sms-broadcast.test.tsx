import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EmergencySmsBroadcast } from "./emergency-sms-broadcast";

const mockGrades = [
  { id: "grade-1", name: "Grade 9" },
  { id: "grade-2", name: "Grade 10" },
];

const mockClasses = [
  { id: "class-1", name: "9-A", gradeLevelId: "grade-1" },
  { id: "class-2", name: "10-B", gradeLevelId: "grade-2" },
];

const mockDispatches = [
  {
    id: "disp-1",
    recipientName: "Arthur Dent",
    recipientPhone: "+44 7700 900011",
    message: "[Northfield Academy] Severe weather alert: school closing early at 13:00.",
    status: "sent",
    sentAt: "2026-09-26T08:30:00Z",
  },
];

const mockOnDispatch = vi.fn();

beforeEach(() => {
  mockOnDispatch.mockReset().mockResolvedValue({ success: true, recipientCount: 45 });
});

afterEach(cleanup);

describe("EmergencySmsBroadcast component", () => {
  it("renders severity selector, scope selector, and live character counter", () => {
    render(
      <EmergencySmsBroadcast
        grades={mockGrades}
        classes={mockClasses}
        dispatches={mockDispatches}
        onDispatch={mockOnDispatch}
        schoolName="Northfield Academy"
      />
    );

    expect(screen.getByRole("heading", { level: 2, name: "Emergency Parent SMS Broadcast" })).toBeTruthy();
    expect(screen.getByLabelText("Alert Severity Category")).toBeTruthy();
    expect(screen.getByLabelText("Recipient Scope")).toBeTruthy();
    expect(screen.getByText("0 / 320 characters (320 remaining)")).toBeTruthy();
    expect(screen.getByText("Arthur Dent")).toBeTruthy();
    expect(screen.getByText("+44 7700 900011")).toBeTruthy();
  });

  it("applies a quick template and updates the message and character counter", () => {
    render(
      <EmergencySmsBroadcast
        grades={mockGrades}
        classes={mockClasses}
        dispatches={mockDispatches}
        onDispatch={mockOnDispatch}
        schoolName="Northfield Academy"
      />
    );

    const templateBtn = screen.getByRole("button", { name: "Severe Weather Closure" });
    fireEvent.click(templateBtn);

    const textarea = screen.getByLabelText("SMS Message Text") as HTMLTextAreaElement;
    expect(textarea.value).toContain("[Northfield Academy] Severe Weather Alert");
    expect(screen.getByText(/characters/)).toBeTruthy();
  });

  it("submits broadcast with confirmation guard and calls onDispatch", async () => {
    render(
      <EmergencySmsBroadcast
        grades={mockGrades}
        classes={mockClasses}
        dispatches={mockDispatches}
        onDispatch={mockOnDispatch}
        schoolName="Northfield Academy"
      />
    );

    const submitBtn = screen.getByRole("button", { name: "Send Emergency SMS Broadcast" });
    expect(submitBtn.hasAttribute("disabled")).toBe(true);

    // Apply template
    fireEvent.click(screen.getByRole("button", { name: "Precautionary Lockdown" }));

    // Still disabled without checkbox
    expect(submitBtn.hasAttribute("disabled")).toBe(true);

    // Check confirmation checkbox
    const confirmCheckbox = screen.getByLabelText(/Emergency Authorization Acknowledgement/);
    fireEvent.click(confirmCheckbox);

    // Now button should be enabled
    expect(submitBtn.hasAttribute("disabled")).toBe(false);

    // Click submit
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnDispatch).toHaveBeenCalledWith({
        kind: "emergency_sms_broadcast",
        scope: "whole_school",
        targetId: "all",
        severity: "lockdown",
        message: expect.stringContaining("lockdown"),
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/Emergency SMS broadcast successfully dispatched to 45 guardians/)).toBeTruthy();
    });
  });

  it("allows selecting specific grade scope", async () => {
    render(
      <EmergencySmsBroadcast
        grades={mockGrades}
        classes={mockClasses}
        dispatches={mockDispatches}
        onDispatch={mockOnDispatch}
        schoolName="Northfield Academy"
      />
    );

    fireEvent.change(screen.getByLabelText("Recipient Scope"), { target: { value: "grade" } });
    expect(screen.getByLabelText("Select Grade Level")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Select Grade Level"), { target: { value: "grade-2" } });
    fireEvent.change(screen.getByLabelText("SMS Message Text"), { target: { value: "Grade 10 field trip return delayed." } });
    fireEvent.click(screen.getByLabelText(/Emergency Authorization Acknowledgement/));

    fireEvent.click(screen.getByRole("button", { name: "Send Emergency SMS Broadcast" }));

    await waitFor(() => {
      expect(mockOnDispatch).toHaveBeenCalledWith({
        kind: "emergency_sms_broadcast",
        scope: "grade",
        targetId: "grade-2",
        severity: "urgent_alert",
        message: "Grade 10 field trip return delayed.",
      });
    });
  });
});
