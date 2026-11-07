/**
 * Timezone handling. The backend stores UTC only; everything is rendered
 * in the viewer's preferred zone, except schedules, which carry their own.
 */

export const SUPPORTED_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
] as const;

export type SupportedTimezone = (typeof SUPPORTED_TIMEZONES)[number] | string;

/** The browser's zone, or UTC when unavailable (e.g. during SSR). */
export function getDefaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Formats a UTC ISO timestamp string into a localized display string. */
export function formatLocalizedTime(
  utcTimestamp: string | null | undefined,
  timeZone: string = getDefaultTimezone(),
  options?: Intl.DateTimeFormatOptions
): string {
  if (!utcTimestamp) return "—";

  try {
    const date = new Date(utcTimestamp);
    if (isNaN(date.getTime())) return "Invalid Date";

    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone,
      ...options,
    };

    return new Intl.DateTimeFormat("en-US", defaultOptions).format(date);
  } catch {
    return utcTimestamp;
  }
}

/**
 * Human-friendly relative time ("3m ago"). Pass `now` from a ticking hook
 * so components stay pure; defaults to the current time.
 */
export function formatRelativeTime(
  utcTimestamp: string | null | undefined,
  now: number = Date.now()
): string {
  if (!utcTimestamp) return "—";
  const then = new Date(utcTimestamp).getTime();
  if (isNaN(then)) return "—";

  const diffSec = Math.round((now - then) / 1000);
  const future = diffSec < 0;
  const s = Math.abs(diffSec);

  let text: string;
  if (s < 45) text = future ? "in a moment" : "just now";
  else if (s < 3600) text = `${Math.round(s / 60)}m`;
  else if (s < 86400) text = `${Math.round(s / 3600)}h`;
  else if (s < 86400 * 30) text = `${Math.round(s / 86400)}d`;
  else if (s < 86400 * 365) text = `${Math.round(s / (86400 * 30))}mo`;
  else text = `${Math.round(s / (86400 * 365))}y`;

  if (text === "just now" || text === "in a moment") return text;
  return future ? `in ${text}` : `${text} ago`;
}

/** Short zone label, e.g. "Karachi" or "UTC". */
export function zoneLabel(tz: string): string {
  if (tz === "UTC") return "UTC";
  const last = tz.split("/").pop() ?? tz;
  return last.replace(/_/g, " ");
}

/** Current UTC offset of a zone in minutes (positive east of UTC). */
export function zoneOffsetMinutes(tz: string, at: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUTC = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUTC - at.getTime()) / 60000);
}

/** "UTC+5", "UTC−4:30" */
export function formatOffset(minutes: number): string {
  if (minutes === 0) return "UTC";
  const sign = minutes > 0 ? "+" : "−";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `UTC${sign}${h}${m ? `:${String(m).padStart(2, "0")}` : ""}`;
}

/** Time-of-day greeting in a given zone. */
export function greetingFor(now: number, tz: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(new Date(now))
  );
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
