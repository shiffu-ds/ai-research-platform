import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import type { ApiError } from "@/lib/api/http";
import { Button } from "./Button";

/** Simple pen-drawn illustrations; slightly irregular on purpose. */
const drawings = {
  notebook: (
    <svg viewBox="0 0 120 90" fill="none" className="h-20 w-auto" aria-hidden>
      <path d="M22 14c18-2 38-1 56 1 4 1 6 3 6 7l-1 52c0 4-2 6-6 6-19 1-37 0-55-1-3 0-5-2-5-6l-1-52c0-4 2-6 6-7Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M33 30c13-1 27-1 40 0M33 41c11-.6 24-.4 35 .3M33 52c9-.4 18-.4 27 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".55" />
      <path d="M87 60c6-9 14-20 21-29 1-2 3-2 4 0l1 1c1 1 1 3 0 4-7 9-14 19-21 28l-6 3 1-7Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  magnifier: (
    <svg viewBox="0 0 120 90" fill="none" className="h-20 w-auto" aria-hidden>
      <path d="M51 19c14-1 25 10 25 23 1 13-10 24-24 24-13 1-24-10-24-23-1-13 10-23 23-24Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M70 61c6 5 12 11 18 17" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M41 36c3-5 8-8 14-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity=".5" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 120 90" fill="none" className="h-20 w-auto" aria-hidden>
      <path d="M28 20c21-1 43-1 64 0 3 0 5 2 5 5l-1 46c0 3-2 5-5 5-21 1-41 1-62 0-3 0-5-2-5-5V25c0-3 1-5 4-5Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M24 33c24-1 48-1 72 0M44 13v13M76 13v13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M40 48h6M57 48h6M74 48h6M40 61h6M57 61h6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity=".5" />
    </svg>
  ),
  plug: (
    <svg viewBox="0 0 120 90" fill="none" className="h-20 w-auto" aria-hidden>
      <path d="M40 30c8-1 16-1 24 0 2 0 3 1 3 3v12c0 9-7 16-15 16s-15-7-15-16V33c0-2 1-3 3-3Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M46 30V18M58 30V18M52 61c0 7 2 12 9 14 9 2 16-3 24-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M92 44l6-6M94 54l8 1M84 38l1-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".6" />
    </svg>
  ),
};

export function EmptyState({
  title,
  children,
  action,
  drawing = "notebook",
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  drawing?: keyof typeof drawings;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", className)}>
      <div className="text-ink-3">{drawings[drawing]}</div>
      <h3 className="mt-4 font-serif text-[19px] text-ink">{title}</h3>
      {children && <div className="mt-1.5 max-w-sm text-[13.5px] text-ink-2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error?: ApiError; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)} role="alert">
      <div className="text-ink-3">{drawings.plug}</div>
      <h3 className="mt-4 font-serif text-[19px] text-ink">That didn&apos;t load</h3>
      <p className="mt-1.5 max-w-sm text-[13.5px] text-ink-2">{error?.friendly ?? "Something went wrong."}</p>
      {error?.requestId && <p className="mt-1 font-mono text-[11.5px] text-ink-3">request {error.requestId}</p>}
      {onRetry && (
        <Button className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
