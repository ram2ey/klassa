import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SchoolAdminGdprPanel } from "./school-admin-gdpr-panel";
import type { SchoolGdprData } from "@/lib/school-gdpr-data";
import type { SchoolAdminData } from "@/lib/school-admin-data";

const mocks = vi.hoisted(() => ({ create: vi.fn(), generate: vi.fn(), decide: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/app/actions/school-gdpr-actions", () => ({ createSchoolGdprRequestAction: mocks.create,
  generateSchoolGdprExtractAction: mocks.generate, decideSchoolGdprRequestAction: mocks.decide }));

const requestId = "00000000-0000-4000-8000-000000000003";
const studentId = "00000000-0000-4000-8000-000000000002";
const students = [{ id: studentId, firstName: "Ada", lastName: "Lee", studentNumber: "ST-1" }] as SchoolAdminData["students"];
const data = { requests: [{ id: requestId, studentId, requestType: "export", status: "pending",
  requesterName: "Pat Parent", requesterRole: "guardian", requesterEmail: "pat@example.com",
  justification: "Requesting a student record extract", safeguardingRedacted: true,
  createdAt: new Date("2026-09-26T10:00:00Z"), processedAt: null,
  studentFirstName: "Ada", studentLastName: "Lee" }] } as SchoolGdprData;

beforeEach(() => {
  mocks.create.mockReset().mockResolvedValue({ success: true, requestId });
  mocks.generate.mockReset().mockResolvedValue({ success: true, extract: { student: { firstName: "Ada" } } });
  mocks.decide.mockReset(); mocks.refresh.mockClear();
});
afterEach(cleanup);

describe("live school data rights panel", () => {
  it("records a new request from the school student list", async () => {
    render(<SchoolAdminGdprPanel data={{ requests: [] }} students={students} />);
    fireEvent.change(screen.getByLabelText("Requester name"), { target: { value: "Pat Parent" } });
    fireEvent.change(screen.getByLabelText("Requester email"), { target: { value: "pat@example.com" } });
    fireEvent.change(screen.getByLabelText("Request details"), { target: { value: "Requesting a student record extract" } });
    fireEvent.click(screen.getByRole("button", { name: "Record request" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith({ studentId, requestType: "export",
      requesterName: "Pat Parent", requesterRole: "guardian", requesterEmail: "pat@example.com",
      justification: "Requesting a student record extract" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });
  it("keeps export fulfillment disabled until an extract has been generated", () => {
    render(<SchoolAdminGdprPanel data={data} students={students} />);
    expect(screen.getByRole("button", { name: "Generate JSON extract" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Mark fulfilled" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Sensitive cases and third-party contacts are excluded/)).toBeTruthy();
  });
  it("downloads an administrator extract and refreshes the ledger", async () => {
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn().mockReturnValue("blob:extract") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      render(<SchoolAdminGdprPanel data={data} students={students} />);
      fireEvent.click(screen.getByRole("button", { name: "Generate JSON extract" }));
      await waitFor(() => expect(mocks.generate).toHaveBeenCalledWith(requestId));
      await waitFor(() => expect(click).toHaveBeenCalledOnce());
      expect(screen.getByRole("status").textContent).toContain("Review it and verify the requester");
      expect(mocks.refresh).toHaveBeenCalledOnce();
    } finally { click.mockRestore(); }
  });
});
