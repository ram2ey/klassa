import { isDemoMode } from "@/lib/runtime-config";

export interface SmsDispatchResult {
  id: string;
  recipientPhone: string;
  recipientName: string;
  studentId: string;
  studentName: string;
  message: string;
  status: "sent" | "delivered" | "failed" | "simulated";
  providerRef: string;
  error?: string;
  sentAt: string;
}

export interface SmsProvider {
  send(to: string, message: string): Promise<{ success: boolean; providerRef: string; error?: string }>;
}

export function normalizePhoneNumber(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+")) {
    // Default country code if missing (e.g., Iceland +354)
    return `+354${cleaned.replace(/^0+/, "")}`;
  }
  return cleaned;
}

export function formatAbsenceAlertMessage(params: {
  studentName: string;
  schoolName: string;
  dateStr: string;
}): string {
  return `[${params.schoolName}] Attendance Alert: ${params.studentName} was marked absent on ${params.dateStr} without prior notice. Please contact the school office or submit an excuse note.`;
}

// In-memory ledger of dispatched SMS messages for preview/dev environments
const smsDispatchHistory: SmsDispatchResult[] = [
  {
    id: "sms-001",
    recipientPhone: "+354 555 0371",
    recipientName: "Robert Martin",
    studentId: "ST-2026-0126",
    studentName: "Elias Martin",
    message: "[Northfield Academy] Attendance Alert: Elias Martin was marked absent on 2026-09-21 without prior notice. Please contact the school office or submit an excuse note.",
    status: "delivered",
    providerRef: "SM_mock_8291410",
    sentAt: "Yesterday, 09:30",
  },
  {
    id: "sms-002",
    recipientPhone: "+354 555 0284",
    recipientName: "Karen Bennett",
    studentId: "ST-2026-0138",
    studentName: "Noah Bennett",
    message: "[Northfield Academy] Attendance Alert: Noah Bennett was marked late (18 min) on 2026-09-18.",
    status: "delivered",
    providerRef: "SM_mock_7182931",
    sentAt: "18 Sep, 09:45",
  },
];

export class MockSmsProvider implements SmsProvider {
  async send(to: string, message: string): Promise<{ success: boolean; providerRef: string; error?: string }> {
    void to;
    void message;
    const providerRef = `SM_mock_${Math.random().toString(36).substring(2, 10)}`;
    return { success: true, providerRef };
  }
}

export class TwilioSmsProvider implements SmsProvider {
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor() {
    this.accountSid = process.env.TWILIO_ACCOUNT_SID || "";
    this.authToken = process.env.TWILIO_AUTH_TOKEN || "";
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || "";
  }

  async send(to: string, message: string): Promise<{ success: boolean; providerRef: string; error?: string }> {
    if (!this.accountSid || !this.authToken || !this.fromNumber) {
      return {
        success: false,
        providerRef: "",
        error: "Twilio credentials not configured. No message was sent.",
      };
    }

    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString("base64");
      const body = new URLSearchParams({
        To: to,
        From: this.fromNumber,
        Body: message,
      });

      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
        signal: AbortSignal.timeout(10_000),
      });

      const data = await res.json();
      if (!res.ok) {
        return { success: false, providerRef: "", error: data.message || "Twilio error" };
      }

      return { success: true, providerRef: data.sid };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown SMS network error";
      return { success: false, providerRef: "", error: message };
    }
  }
}

export function getSmsProvider(): SmsProvider {
  if (isDemoMode()) return new MockSmsProvider();
  if (process.env.SMS_PROVIDER === "twilio") {
    return new TwilioSmsProvider();
  }
  throw new Error("SMS provider is not configured. No message was sent.");
}

export async function dispatchAbsenceAlert(params: {
  recipientPhone: string;
  recipientName: string;
  studentId: string;
  studentName: string;
  dateStr: string;
  schoolName?: string;
}): Promise<SmsDispatchResult> {
  const provider = getSmsProvider();
  const normalizedPhone = normalizePhoneNumber(params.recipientPhone);
  const message = formatAbsenceAlertMessage({
    studentName: params.studentName,
    schoolName: params.schoolName || "Northfield Academy",
    dateStr: params.dateStr,
  });

  const result = await provider.send(normalizedPhone, message);

  const dispatchItem: SmsDispatchResult = {
    id: `sms-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    recipientPhone: normalizedPhone,
    recipientName: params.recipientName,
    studentId: params.studentId,
    studentName: params.studentName,
    message,
    status: result.success ? (isDemoMode() ? "simulated" : "sent") : "failed",
    providerRef: result.providerRef || `ERR_${Date.now()}`,
    error: result.error,
    sentAt: "Just now",
  };

  smsDispatchHistory.unshift(dispatchItem);
  return dispatchItem;
}

export function getSmsDispatchHistory(): SmsDispatchResult[] {
  return [...smsDispatchHistory];
}
