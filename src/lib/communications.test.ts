import { describe, it, expect } from "vitest";
import {
  canDispatchSms,
  generateDispatchIdempotencyKey,
  isDuplicateDispatch,
  renderCommunicationTemplate,
  calculateSmsSegments,
  calculateReadRate,
  announcementInputSchema,
} from "./communications";

describe("Phase 4: School Communications Domain Logic", () => {
  describe("canDispatchSms & Guardian Consent", () => {
    const fullConsent = {
      optInSmsAnnouncements: true,
    };

    const restrictedConsent = {
      optInSmsAnnouncements: false,
    };

    it("allows dispatch if consent record is undefined (default institutional opt-in)", () => {
      const res = canDispatchSms(undefined);
      expect(res.allowed).toBe(true);
      expect(res.reason).toContain("Default");
    });

    it("allows dispatch for opted-in announcement channels", () => {
      const res = canDispatchSms(fullConsent);
      expect(res.allowed).toBe(true);
    });

    it("blocks dispatch when guardian has opted out of announcements", () => {
      const res = canDispatchSms(restrictedConsent);
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("opted out");
    });

  });

  describe("generateDispatchIdempotencyKey & Duplicate Detection", () => {
    it("generates deterministic key for identical phone and announcement within same window", () => {
      const key1 = generateDispatchIdempotencyKey("anc-123", "+1 (555) 019-2831", 60000);
      const key2 = generateDispatchIdempotencyKey("anc-123", "5550192831", 60000);
      expect(key1).toBe(key2);
      expect(key1).toContain("anc-123");
      expect(key1).toContain("5550192831");
    });

    it("flags duplicate dispatch if sent within the window", () => {
      const recent = [
        {
          phone: "+1 555 019 2831",
          announcementId: "anc-123",
          sentAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
        },
      ];

      const isDup = isDuplicateDispatch(recent, "555-019-2831", "anc-123", 30);
      expect(isDup).toBe(true);
    });

    it("allows dispatch if outside window or different announcement", () => {
      const recent = [
        {
          phone: "+1 555 019 2831",
          announcementId: "anc-123",
          sentAt: new Date(Date.now() - 40 * 60 * 1000), // 40 min ago (> 30)
        },
      ];

      const isDupTime = isDuplicateDispatch(recent, "555-019-2831", "anc-123", 30);
      expect(isDupTime).toBe(false);

      const isDupOther = isDuplicateDispatch(recent, "555-019-2831", "anc-different", 30);
      expect(isDupOther).toBe(false);
    });
  });

  describe("renderCommunicationTemplate", () => {
    it("interpolates template tokens with provided dictionary", () => {
      const template = "Notice for {{student_name}} in {{class_name}} on {{date}}.";
      const rendered = renderCommunicationTemplate(template, {
        student_name: "Amelia Warren",
        class_name: "Grade 10-A",
        date: "2026-03-22",
      });

      expect(rendered).toBe("Notice for Amelia Warren in Grade 10-A on 2026-03-22.");
    });

    it("handles whitespace in token brackets and leaves unmatched tokens untouched", () => {
      const template = "Hello {{ student_name }}, your exam room is {{ room_number }}. Portal: {{portal}}";
      const rendered = renderCommunicationTemplate(template, {
        student_name: "Lucas Vance",
      });

      expect(rendered).toBe("Hello Lucas Vance, your exam room is {{room_number}}. Portal: {{portal}}");
    });
  });

  describe("calculateSmsSegments & Cost Ledger", () => {
    it("computes single segment for text <= 160 chars", () => {
      const text = "Brief school notification within single GSM length standard limit.";
      const res = calculateSmsSegments(text);
      expect(res.characters).toBe(text.length);
      expect(res.segments).toBe(1);
      expect(res.estimatedCost).toBe(0.015);
    });

    it("computes multi-segment for text > 160 chars using 153 chars/segment header protocol", () => {
      const longText = "A".repeat(161);
      const res = calculateSmsSegments(longText);
      expect(res.characters).toBe(161);
      expect(res.segments).toBe(2);
      expect(res.estimatedCost).toBe(0.03);

      const veryLongText = "A".repeat(320);
      const res2 = calculateSmsSegments(veryLongText);
      expect(res2.segments).toBe(3);
    });

    it("returns 0 for empty text", () => {
      const res = calculateSmsSegments("");
      expect(res.segments).toBe(0);
      expect(res.estimatedCost).toBe(0);
    });
  });

  describe("calculateReadRate", () => {
    it("computes correct percentage and clamps values", () => {
      const rate1 = calculateReadRate(100, 75);
      expect(rate1.percentage).toBe(75);

      const rate2 = calculateReadRate(0, 0);
      expect(rate2.percentage).toBe(0);

      const rateClamped = calculateReadRate(50, 60);
      expect(rateClamped.percentage).toBe(100);
    });
  });

  describe("Zod Validation Schemas", () => {
    it("validates announcement input correctly", () => {
      const valid = announcementInputSchema.safeParse({
        title: "Staff Meeting Tomorrow",
        content: "Please gather at 08:00 in Room 101 for briefing.",
        targetType: "school",
        targetId: "all",
        priority: "normal",
        channels: "in_app",
      });
      expect(valid.success).toBe(true);

      const invalid = announcementInputSchema.safeParse({
        title: "Hi", // too short
        content: "No",
      });
      expect(invalid.success).toBe(false);
    });

  });
});
