import { describe, expect, it } from "vitest";
import {
  dispatchAbsenceAlert,
  formatAbsenceAlertMessage,
  getSmsDispatchHistory,
  normalizePhoneNumber,
} from "./sms";

describe("SMS Gateway & Absence Alerts", () => {
  it("normalizes diverse phone number formats", () => {
    expect(normalizePhoneNumber("+354 555 0192")).toBe("+3545550192");
    expect(normalizePhoneNumber("555 0192")).toBe("+3545550192");
    expect(normalizePhoneNumber("+1 (555) 234-5678")).toBe("+15552345678");
  });

  it("formats absence alert messages with school context and student details", () => {
    const msg = formatAbsenceAlertMessage({
      studentName: "Elias Martin",
      schoolName: "Northfield Academy",
      dateStr: "2026-09-22",
    });

    expect(msg).toContain("[Northfield Academy] Attendance Alert: Elias Martin was marked absent on 2026-09-22");
    expect(msg).toContain("Please contact the school office or submit an excuse note.");
  });

  it("dispatches alerts and records to dispatch history", async () => {
    const initialCount = getSmsDispatchHistory().length;
    const result = await dispatchAbsenceAlert({
      recipientPhone: "+354 555 0192",
      recipientName: "David Warren",
      studentId: "ST-2026-0142",
      studentName: "Amelia Warren",
      dateStr: "2026-09-22",
    });

    expect(result.status).toBe("simulated");
    expect(result.recipientPhone).toBe("+3545550192");
    expect(result.providerRef).toMatch(/^SM_mock_/);

    const history = getSmsDispatchHistory();
    expect(history.length).toBe(initialCount + 1);
    expect(history[0].id).toBe(result.id);
  });
});
