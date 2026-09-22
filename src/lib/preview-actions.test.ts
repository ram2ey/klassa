import { describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/action-access", () => ({ requireDemoAction: async () => {} }));
vi.mock("@/lib/audit", () => ({ logAuditEvent: vi.fn(), AuditActions: {} }));
import { createAnnouncementAction, getSmsDeliveryLedgerAction, initiateEmergencyBroadcastAction } from "@/app/actions/communication-actions";
import { executeAnonymizeStudentAction, getGdprRequestsAction } from "@/app/actions/gdpr-actions";
import { announcementInputSchema, emergencyBroadcastInputSchema } from "./communications";

describe("honest preview operations", () => {
  it("does not simulate SMS before a scheduled announcement is due", async () => {
    const before = (await getSmsDeliveryLedgerAction()).ledger.length;
    const result = await createAnnouncementAction(announcementInputSchema.parse({
      title: "Scheduled message", content: "A scheduled preview announcement", channels: "sms", scheduledFor: "2030-01-01T09:00:00Z",
    }));
    expect(result.success).toBe(true);
    expect((await getSmsDeliveryLedgerAction()).ledger).toHaveLength(before);
  });
  it("never labels simulated delivery as actual delivery or charges money", async () => {
    const result = await createAnnouncementAction(announcementInputSchema.parse({
      title: "Simulation test", content: "A school-wide preview announcement", channels: "sms",
    }));
    expect(result.success).toBe(true);
    const items = (await getSmsDeliveryLedgerAction()).ledger.filter(item => item.announcementTitle === "Simulation test");
    expect(items.length).toBeGreaterThan(0);
    expect(items.every(item => item.status === "simulated" && item.cost === 0)).toBe(true);
  });
  it("rejects unresolved class audiences", async () => {
    const before = (await getSmsDeliveryLedgerAction()).ledger.length;
    const result = await createAnnouncementAction(announcementInputSchema.parse({
      title: "Class message", content: "Only this class should receive this", channels: "sms", targetType: "class", targetId: "cls-7b",
    }));
    expect(result.success).toBe(false);
    expect((await getSmsDeliveryLedgerAction()).ledger).toHaveLength(before);
  });
  it("does not dispatch SMS for an in-app emergency preview", async () => {
    const before = (await getSmsDeliveryLedgerAction()).ledger.length;
    const result = await initiateEmergencyBroadcastAction(emergencyBroadcastInputSchema.parse({
      title: "Emergency simulation", content: "An in-app only safety simulation", channels: "in_app",
      firstApproverId: "usr-admin-1", secondApproverId: "usr-principal-1", securityConfirmation: true,
    }));
    expect(result.success).toBe(true);
    expect((await getSmsDeliveryLedgerAction()).ledger).toHaveLength(before);
  });
  it("does not mark requests complete when erasure is unavailable", async () => {
    const before = structuredClone(await getGdprRequestsAction());
    const result = await executeAnonymizeStudentAction({ id: "student-a", firstName: "A", lastName: "B", dateOfBirth: "2010-01-01" },
      "An approved test request", "school_admin", "staff-a");
    expect(result.success).toBe(false);
    expect(result.anonymizedStudent).toBeUndefined();
    expect(await getGdprRequestsAction()).toEqual(before);
  });
});
