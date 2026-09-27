/** Fixed school timezone until per-school timezone support is needed. */
export const SCHOOL_TIME_ZONE = "Etc/GMT";
export const SCHOOL_TIME_ZONE_LABEL = "GMT";

export function formatGMTDate(value: string | Date) {
  return new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: SCHOOL_TIME_ZONE }).format(new Date(value));
}

export function formatGMTDateTime(value: string | Date) {
  return `${new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeStyle: "short",
    timeZone: SCHOOL_TIME_ZONE }).format(new Date(value))} GMT`;
}

export function formatGMTTime(value: string | Date) {
  return `${new Intl.DateTimeFormat("en-GH", { timeStyle: "short",
    timeZone: SCHOOL_TIME_ZONE }).format(new Date(value))} GMT`;
}
