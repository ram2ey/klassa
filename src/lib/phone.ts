import { z } from "zod";

/** Require a country code; never guess which school's country a staff member lives in. */
export const phoneNumberSchema = z.string().trim().max(40)
  .transform(value => value.replace(/[\s().-]/g, ""))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "Use an international mobile number, including + and country code."));

export function maskPhoneNumber(phone: string) {
  return `${phone.slice(0, 3)}${"•".repeat(Math.max(0, phone.length - 7))}${phone.slice(-4)}`;
}
