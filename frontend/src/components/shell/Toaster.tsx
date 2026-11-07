"use client";

import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { useToasts, type Toast } from "@/stores/toast.store";
import { cn } from "@/lib/utils/cn";

const icons = {
  neutral: <Info className="h-4 w-4 text-ink-3" />,
  success: <CheckCircle2 className="h-4 w-4 text-st-success" />,
  warning: <AlertTriangle className="h-4 w-4 text-st-process" />,
  danger: <XCircle className="h-4 w-4 text-st-failure" />,
};

function ToastItem({ t }: { t: Toast }) {
  const dismiss = useToasts((s) => s.dismiss);
  useEffect(() => {
    if (!t.duration) return;
    const timer = setTimeout(() => dismiss(t.id), t.duration);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, dismiss]);

  return (
    <div
      role={t.tone === "danger" ? "alert" : "status"}
      className="pointer-events-auto flex w-full animate-rise items-start gap-3 rounded-lg border border-line bg-surface p-3.5 shadow-lg sm:w-[360px]"
    >
      <span className="mt-0.5">{icons[t.tone]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-ink">{t.title}</p>
        {t.description && <p className="mt-0.5 text-[13px] text-ink-2">{t.description}</p>}
      </div>
      {t.action && (
        <button
          type="button"
          onClick={() => {
            t.action!.onClick();
            dismiss(t.id);
          }}
          className="shrink-0 rounded-md px-2 py-1 text-[13px] font-semibold text-accent hover:bg-accent-soft"
        >
          {t.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => dismiss(t.id)}
        className={cn("shrink-0 rounded p-1 text-ink-3 hover:bg-sunken hover:text-ink", t.action && "hidden sm:block")}
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToasts((s) => s.toasts);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} />
      ))}
    </div>
  );
}
