import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ParentSmsAnnouncements } from "./parent-sms-announcements";

describe("ParentSmsAnnouncements", () => {
  it("updates the segment estimate for Unicode messages", () => {
    render(<ParentSmsAnnouncements grades={[]} classes={[]} onPreview={vi.fn()} onQueue={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "“".repeat(71) } });
    expect(screen.getByText(/71\/320 characters · 2 SMS segments/)).toBeTruthy();
  });
  it("requires recipient review before queueing a class message", async () => {
    const onPreview = vi.fn().mockResolvedValue({ success: true, recipientCount: 3, unreachableCount: 1 });
    const onQueue = vi.fn().mockResolvedValue({ success: true, queuedCount: 3, unreachableCount: 1 });
    render(<ParentSmsAnnouncements grades={[{ id: "grade-1", name: "Basic 5" }]}
      classes={[{ id: "class-1", name: "Basic 5A", gradeLevelId: "grade-1" }]}
      onPreview={onPreview} onQueue={onQueue} />);

    fireEvent.change(screen.getByLabelText("Recipients"), { target: { value: "class" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "School closes at noon today." } });
    fireEvent.click(screen.getByRole("button", { name: "Review recipients" }));

    await screen.findByText((_, element) => element?.tagName === "P" && /3 reachable guardian numbers/.test(element.textContent ?? ""));
    expect(onPreview).toHaveBeenCalledWith({ scope: "class", targetId: "class-1", message: "School closes at noon today." });
    expect(onQueue).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole("button", { name: "Queue 3 messages" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Queue 3 messages" }));
    await waitFor(() => expect(onQueue).toHaveBeenCalledWith({ scope: "class", targetId: "class-1", message: "School closes at noon today.", requestId: expect.any(String) }));
    expect((await screen.findByRole("status")).textContent).toContain("3 parent messages queued");
  });

  it("reuses the request ID after a lost response and replaces it for a new message", async () => {
    const onPreview = vi.fn().mockResolvedValue({ success: true, recipientCount: 1, unreachableCount: 0 });
    const onQueue = vi.fn().mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValue({ success: true, queuedCount: 1, unreachableCount: 0 });
    render(<ParentSmsAnnouncements grades={[]} classes={[]} onPreview={onPreview} onQueue={onQueue} />);
    async function review(message: string) {
      fireEvent.change(screen.getByLabelText("Message"), { target: { value: message } });
      fireEvent.click(screen.getByRole("button", { name: "Review recipients" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "Queue 1 message" }).hasAttribute("disabled")).toBe(false));
    }
    await review("School closes at noon today.");
    fireEvent.click(screen.getByRole("button", { name: "Queue 1 message" }));
    await screen.findByText(/Could not confirm queueing/);
    await waitFor(() => expect(screen.getByRole("button", { name: "Queue 1 message" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Queue 1 message" }));
    await waitFor(() => expect(onQueue).toHaveBeenCalledTimes(2));
    expect(onQueue.mock.calls[1][0].requestId).toBe(onQueue.mock.calls[0][0].requestId);
    await screen.findByText(/1 parent message queued/);
    await review("Tomorrow's school starts at eight.");
    fireEvent.click(screen.getByRole("button", { name: "Queue 1 message" }));
    await waitFor(() => expect(onQueue).toHaveBeenCalledTimes(3));
    expect(onQueue.mock.calls[2][0].requestId).not.toBe(onQueue.mock.calls[0][0].requestId);
  });
});
