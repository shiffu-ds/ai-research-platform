/**
 * Recurring research schedules. Each schedule is evaluated in its *own*
 * timezone (not the viewer's), so "every weekday at 09:00 Karachi" fires
 * at 09:00 in Karachi regardless of who is looking.
 */

import type { ResearchSchedule, ScheduleFrequency } from "@/types/platform.types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface ZonedParts {
  year: number;
  month: number; // 1..12
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0..6
}

function zonedParts(date: Date, tz: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayIdx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: weekdayIdx,
  };
}

/** Converts a wall-clock time in `tz` to a UTC Date (two-pass offset correction). */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const offset1 = offsetAt(new Date(guess), tz);
  const first = guess - offset1 * 60000;
  const offset2 = offsetAt(new Date(first), tz);
  return new Date(guess - offset2 * 60000);
}

function offsetAt(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUTC - Math.floor(date.getTime() / 60000) * 60000) / 60000);
}

function matchesDay(s: Pick<ResearchSchedule, "frequency" | "dayOfWeek" | "dayOfMonth">, p: ZonedParts): boolean {
  switch (s.frequency) {
    case "daily":
      return true;
    case "weekdays":
      return p.weekday >= 1 && p.weekday <= 5;
    case "weekly":
      return p.weekday === (s.dayOfWeek ?? 1);
    case "monthly":
      return p.day === (s.dayOfMonth ?? 1);
  }
}

/**
 * Next `count` fire times strictly after `from`, as UTC Dates.
 * Walks forward day by day in the schedule's zone (bounded to ~14 months).
 */
export function nextRuns(
  s: Pick<ResearchSchedule, "frequency" | "time" | "dayOfWeek" | "dayOfMonth" | "timezone">,
  from: Date,
  count = 3
): Date[] {
  const [hh, mm] = s.time.split(":").map(Number);
  const out: Date[] = [];
  const start = zonedParts(from, s.timezone);
  // Day cursor as a UTC date at noon to avoid DST edges while iterating calendar days.
  const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day, 12));

  for (let i = 0; i < 430 && out.length < count; i++) {
    const y = cursor.getUTCFullYear();
    const mo = cursor.getUTCMonth() + 1;
    const d = cursor.getUTCDate();
    const candidate = zonedTimeToUtc(y, mo, d, hh, mm, s.timezone);
    const parts = zonedParts(candidate, s.timezone);
    if (candidate.getTime() > from.getTime() && matchesDay(s, parts)) out.push(candidate);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/** Equivalent cron expression, for people who think in cron. */
export function toCron(s: Pick<ResearchSchedule, "frequency" | "time" | "dayOfWeek" | "dayOfMonth">): string {
  const [hh, mm] = s.time.split(":").map(Number);
  switch (s.frequency) {
    case "daily":
      return `${mm} ${hh} * * *`;
    case "weekdays":
      return `${mm} ${hh} * * 1-5`;
    case "weekly":
      return `${mm} ${hh} * * ${s.dayOfWeek ?? 1}`;
    case "monthly":
      return `${mm} ${hh} ${s.dayOfMonth ?? 1} * *`;
  }
}

function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "Every weekday at 09:00" */
export function describeSchedule(
  s: Pick<ResearchSchedule, "frequency" | "time" | "dayOfWeek" | "dayOfMonth">
): string {
  const labels: Record<ScheduleFrequency, string> = {
    daily: "Every day",
    weekdays: "Every weekday",
    weekly: `Every ${DAY_NAMES[s.dayOfWeek ?? 1]}`,
    monthly: `Monthly on the ${ordinal(s.dayOfMonth ?? 1)}`,
  };
  return `${labels[s.frequency]} at ${s.time}`;
}

export { DAY_NAMES };
