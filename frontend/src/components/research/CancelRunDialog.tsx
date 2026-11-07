"use client";

/**
 * Cancelling is a request, not an instant stop: the worker has to
 * acknowledge within 10 seconds. The dialog asks why (it ends up in the
 * audit trail), sends the request, then shows the acknowledgement clock.
 */

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Field";
import { cn } from "@/lib/utils/cn";

const REASONS = ["Wrong question or scope", "Taking too long", "Duplicate of another run", "Budget"] as const;
export const CANCEL_SLA_SECONDS = 10;

export function CancelRunDialog({
  open,
  onClose,
  onConfirm,
  cancelRequestedAt,
  acknowledged,
  acknowledgedAt,
  now,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  cancelRequestedAt?: number;
  acknowledged: boolean;
  /** When the cancelled event arrived — freezes the clock */
  acknowledgedAt?: number;
  now: number;
}) {
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const waiting = cancelRequestedAt !== undefined && !acknowledged;
  const end = acknowledged && acknowledgedAt ? acknowledgedAt : now;
  const elapsed = cancelRequestedAt ? Math.max(0, (end - cancelRequestedAt) / 1000) : 0;
  const remaining = Math.max(0, CANCEL_SLA_SECONDS - elapsed);
  const breached = waiting && remaining === 0;

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (acknowledged && open) {
      const t = setTimeout(() => onCloseRef.current(), 1600);
      return () => clearTimeout(t);
    }
  }, [acknowledged, open]);

  const R = 26;
  const C = 2 * Math.PI * R;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={acknowledged ? "Run cancelled" : waiting ? "Stopping the run…" : "Cancel this run?"}
      description={
        acknowledged
          ? "The worker stopped and cleaned up. Evidence gathered so far is kept."
          : waiting
            ? "The request is sent. The worker should acknowledge within 10 seconds."
            : "Work done so far is kept, but no report will be produced."
      }
      footer={
        waiting || acknowledged ? (
          <Button onClick={onClose}>{acknowledged ? "Done" : "Hide"}</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Keep running
            </Button>
            <Button
              variant="danger"
              loading={sending}
              onClick={async () => {
                setSending(true);
                try {
                  await onConfirm(note.trim() ? `${reason} — ${note.trim()}` : reason);
                } finally {
                  setSending(false);
                }
              }}
            >
              Cancel run
            </Button>
          </>
        )
      }
    >
      {waiting || acknowledged ? (
        <div className="flex items-center gap-5 py-2">
          <svg width="64" height="64" viewBox="0 0 64 64" className="shrink-0 -rotate-90" aria-hidden>
            <circle cx="32" cy="32" r={R} stroke="var(--line)" strokeWidth="5" fill="none" />
            <circle
              cx="32"
              cy="32"
              r={R}
              stroke={acknowledged ? "var(--st-success)" : breached ? "var(--st-failure)" : "var(--st-control)"}
              strokeWidth="5"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={acknowledged ? 0 : C * (remaining / CANCEL_SLA_SECONDS)}
              style={{ transition: "stroke-dashoffset 0.25s linear, stroke 0.3s" }}
            />
          </svg>
          <div aria-live="polite">
            <p className="tnum font-serif text-[28px] leading-none text-ink">
              {acknowledged ? "Done" : breached ? "Late" : `${remaining.toFixed(1)}s`}
            </p>
            <p className="mt-1.5 text-[13px] text-ink-2">
              {acknowledged
                ? `Acknowledged after ${elapsed.toFixed(1)}s.`
                : breached
                  ? "Past the 10-second window — the worker may be stuck. This will update as soon as it responds."
                  : "Waiting for the worker to confirm."}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-ink">Why are you stopping it?</legend>
            <div className="flex flex-wrap gap-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  aria-pressed={reason === r}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[13px] transition-colors",
                    reason === r ? "border-ink bg-ink text-paper" : "border-line text-ink-2 hover:border-line-strong"
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </fieldset>
          <Field label="Anything to add?" optional hint="Saved with the cancellation in the audit log.">
            {(p) => <Textarea {...p} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Rerunning with a narrower question" />}
          </Field>
        </div>
      )}
    </Dialog>
  );
}
