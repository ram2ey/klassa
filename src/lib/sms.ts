import { isDemoMode } from "@/lib/runtime-config";

export interface SmsProvider {
  send(to: string, message: string): Promise<{ success: boolean; providerRef: string; error?: string }>;
}

export function normalizePhoneNumber(raw: string): string {
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned.startsWith("+")) {
    return cleaned.startsWith("233") ? `+${cleaned}` : `+233${cleaned.replace(/^0+/, "")}`;
  }
  return cleaned;
}

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

export class MnotifySmsProvider implements SmsProvider {
  async send(to: string, message: string): Promise<{ success: boolean; providerRef: string; error?: string }> {
    const key = process.env.MNOTIFY_API_KEY;
    const sender = process.env.MNOTIFY_SENDER_ID;
    if (process.env.SMS_DELIVERY_ENABLED !== "true" || !key || !sender || !/^[A-Za-z0-9 _-]{1,11}$/.test(sender)) {
      return { success: false, providerRef: "", error: "mNotify delivery is not configured." };
    }
    const url = new URL("https://api.mnotify.com/api/sms/quick");
    url.searchParams.set("key", key);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: [normalizePhoneNumber(to)], sender, message, is_schedule: false, schedule_date: "" }),
        signal: AbortSignal.timeout(15_000) });
      const payload = await response.json();
      const ref = payload?.summary?._id;
      if (!response.ok || payload?.status !== "success" || typeof ref !== "string" || !ref) {
        return { success: false, providerRef: "", error: "mNotify rejected the message." };
      }
      return { success: true, providerRef: ref };
    } catch {
      return { success: false, providerRef: "", error: "mNotify outcome unknown; check provider before retrying." };
    }
  }
}

export function getSmsProvider(): SmsProvider {
  if (isDemoMode()) return new MockSmsProvider();
  if (process.env.SMS_PROVIDER === "mnotify") return new MnotifySmsProvider();
  if (process.env.SMS_PROVIDER === "twilio") {
    return new TwilioSmsProvider();
  }
  throw new Error("SMS provider is not configured. No message was sent.");
}
