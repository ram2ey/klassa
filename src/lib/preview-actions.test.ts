import { describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/action-access", () => ({ requireDemoAction: async () => {} }));
vi.mock("@/lib/audit", () => ({ logAuditEvent: vi.fn(), AuditActions: {} }));
import { createAnnouncementAction, getSmsDeliveryLedgerAction } from "@/app/actions/communication-actions";
import { executeAnonymizeStudentAction, getGdprRequestsAction } from "@/app/actions/gdpr-actions";
import { announcementInputSchema } from "./communications";

describe("honest preview operations", () => {
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
  it("does not mark requests complete when erasure is unavailable", async () => {
    const before = structuredClone(await getGdprRequestsAction());
    const result = await executeAnonymizeStudentAction({ id: "student-a", firstName: "A", lastName: "B", dateOfBirth: "2010-01-01" },
      "An approved test request", "school_admin", "staff-a");
    expect(result.success).toBe(false);
    expect(result.anonymizedStudent).toBeUndefined();
    expect(await getGdprRequestsAction()).toEqual(before);
  });
});
