"use client";

/**
 * Timestamps that respect the viewer's timezone without hydration
 * mismatches: the server renders a neutral placeholder; the client fills
 * in the localised text after hydration.
 */

import { formatLocalizedTime, formatRelativeTime } from "@/lib/utils/timezone";
import { useNow } from "@/hooks/useNow";
import { useHydrated } from "@/hooks/useHydrated";
import { useTimezone } from "@/hooks/useSession";

export function RelativeTime({ iso, className }: { iso?: string | null; className?: string }) {
  const now = useNow(30_000);
  const tz = useTimezone();
  const hydrated = useHydrated();
  if (!iso) return <span className={className}>—</span>;
  return (
    <time
      dateTime={iso}
      className={className}
      title={hydrated ? `${formatLocalizedTime(iso, tz)} (${tz})` : undefined}
      suppressHydrationWarning
    >
      {hydrated && now ? formatRelativeTime(iso, now) : " "}
    </time>
  );
}

export function LocalTime({
  iso,
  options,
  className,
  zone,
}: {
  iso?: string | null;
  options?: Intl.DateTimeFormatOptions;
  className?: string;
  /** Override the viewer's zone (e.g. a schedule's own timezone) */
  zone?: string;
}) {
  const viewerTz = useTimezone();
  const hydrated = useHydrated();
  if (!iso) return <span className={className}>—</span>;
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {hydrated ? formatLocalizedTime(iso, zone ?? viewerTz, options) : " "}
    </time>
  );
}

export const DATE_SHORT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: undefined, minute: undefined, second: undefined, year: undefined };
export const DATE_YEAR: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric", hour: undefined, minute: undefined, second: undefined };
export const DATE_TIME: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: undefined, year: undefined };
export const TIME_ONLY: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit", second: "2-digit", year: undefined, month: undefined, day: undefined };
