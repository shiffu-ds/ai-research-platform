"use client";

/**
 * Hand-built SVG charts. Specs follow the dataviz method: bars ≤ 24px
 * with a 4px rounded data end and a square baseline, 2px surface gaps
 * between stacked segments, 2px lines, hairline grid, one y-axis, a
 * legend for 2+ series, hover/focus tooltips, and a table view.
 */

import { useCallback, useId, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

// ── sizing ──────────────────────────────────────────────────────

function useWidth(ref: React.RefObject<HTMLElement | null>, fallback = 600) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const el = ref.current;
      if (!el) return () => {};
      const ro = new ResizeObserver(cb);
      ro.observe(el);
      return () => ro.disconnect();
    },
    [ref]
  );
  return useSyncExternalStore(
    subscribe,
    () => ref.current?.clientWidth || fallback,
    () => fallback
  );
}

/** Axis scale with 1/2/5×10ᵏ steps, so counts never get fractional ticks. */
export function niceScale(maxValue: number, target = 4): { max: number; ticks: number[] } {
  if (!(maxValue > 0)) return { max: 1, ticks: [0, 1] };
  const raw = maxValue / target;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / exp;
  const step = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp;
  const max = Math.ceil(maxValue / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(+v.toFixed(6));
  return { max, ticks };
}

/** Column path: rounded at the data end, square at the baseline. */
function columnPath(x: number, y: number, w: number, h: number, r: number): string {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

// ── shared chrome ───────────────────────────────────────────────

export interface Series {
  key: string;
  label: string;
  color: string; // CSS var reference, e.g. "var(--viz-1)"
}

export function Legend({ series, shape = "rect" }: { series: Series[]; shape?: "rect" | "line" }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-2">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          {shape === "rect" ? (
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: s.color }} aria-hidden />
          ) : (
            <span className="h-[2px] w-3 rounded" style={{ background: s.color }} aria-hidden />
          )}
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(8, x - 80), width - 168);
  return (
    <div
      className="pointer-events-none absolute z-10 w-40 rounded-lg border border-line bg-surface px-3 py-2 text-[12.5px] shadow-md"
      style={{ left, top: Math.max(0, y - 8), transform: "translateY(-100%)" }}
    >
      {children}
    </div>
  );
}

export function TooltipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-ink-3">
        {color && <span className="h-[2px] w-2.5 rounded" style={{ background: color }} aria-hidden />}
        {label}
      </span>
      <span className="tnum font-semibold text-ink">{value}</span>
    </div>
  );
}

export function ChartTable<T>({
  rows,
  columns,
  caption,
}: {
  rows: T[];
  columns: { key: string; label: string; render: (r: T) => ReactNode; align?: "right" }[];
  caption: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line text-left text-[12px] text-ink-3">
            {columns.map((c) => (
              <th key={c.key} className={cn("py-2 pr-4 font-medium", c.align === "right" && "text-right")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} className={cn("tnum py-2 pr-4 text-ink-2", c.align === "right" && "text-right")}>
                  {c.render(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── stacked / single column chart ───────────────────────────────

export interface ColumnDatum {
  label: string;
  /** Long label for tooltips */
  title?: string;
  values: Record<string, number>;
}

export function ColumnChart({
  data,
  series,
  height = 220,
  format = (v) => String(v),
  ariaLabel,
  threshold,
  highlight,
}: {
  data: ColumnDatum[];
  series: Series[];
  height?: number;
  format?: (v: number) => string;
  ariaLabel: string;
  threshold?: { at: number; label: string };
  /** Index → series key override color (e.g. bars beyond an SLA) */
  highlight?: (d: ColumnDatum, i: number) => string | undefined;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();

  const pad = { top: 12, right: 8, bottom: 26, left: 44 };
  const innerW = Math.max(10, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const totals = data.map((d) => series.reduce((sum, s) => sum + (d.values[s.key] ?? 0), 0));
  const { max, ticks: yTicks } = niceScale(Math.max(...totals, 0));
  const band = innerW / Math.max(1, data.length);
  const barW = Math.min(24, band * 0.56);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;
  const GAP = 2;

  // Threshold for a histogram: position between categories (fractional index).
  const thresholdX = threshold ? pad.left + threshold.at * band : null;

  return (
    <div ref={wrap} className="relative">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((h) => Math.min(data.length - 1, (h ?? -1) + 1));
          if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? data.length) - 1));
          if (e.key === "Escape") setHover(null);
        }}
        onBlur={() => setHover(null)}
        onPointerLeave={() => setHover(null)}
        className="block overflow-visible focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        {/* grid + y ticks */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={pad.left + innerW} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tnum fill-ink-3 text-[11px]">
              {format(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = pad.left + band * i + band / 2;
          let acc = 0;
          const present = series.filter((s) => (d.values[s.key] ?? 0) > 0);
          return (
            <g key={d.label} opacity={hover === null || hover === i ? 1 : 0.55} style={{ transition: "opacity 120ms" }}>
              {/* hit target: the whole band */}
              <rect
                x={pad.left + band * i}
                y={pad.top}
                width={band}
                height={innerH}
                fill="transparent"
                onPointerEnter={() => setHover(i)}
                onPointerMove={() => setHover(i)}
              />
              {present.map((s, si) => {
                const v = d.values[s.key] ?? 0;
                const top = y(acc + v);
                const bottom = y(acc);
                acc += v;
                const isTop = si === present.length - 1;
                const h = Math.max(0, bottom - top - (si > 0 ? GAP : 0));
                const color = highlight?.(d, i) ?? s.color;
                return isTop ? (
                  <path key={s.key} d={columnPath(cx - barW / 2, top, barW, h, 4)} fill={color} pointerEvents="none" />
                ) : (
                  <rect key={s.key} x={cx - barW / 2} y={top + (si > 0 ? 0 : 0)} width={barW} height={h} fill={color} pointerEvents="none" />
                );
              })}
              <text x={cx} y={height - 8} textAnchor="middle" className="fill-ink-3 text-[11px]">
                {d.label}
              </text>
            </g>
          );
        })}

        {thresholdX !== null && threshold && (
          <g pointerEvents="none">
            <line x1={thresholdX} x2={thresholdX} y1={pad.top - 4} y2={pad.top + innerH} stroke="var(--ink-2)" strokeWidth={1} />
            <text x={thresholdX + 6} y={pad.top + 6} className="fill-ink-2 text-[11px] font-medium">
              {threshold.label}
            </text>
          </g>
        )}

        <line x1={pad.left} x2={pad.left + innerW} y1={pad.top + innerH} y2={pad.top + innerH} stroke="var(--line-strong)" strokeWidth={1} />
      </svg>

      {hover !== null && data[hover] && (
        <Tooltip x={pad.left + band * hover + band / 2} y={y(totals[hover])} width={width}>
          <p id={`${id}-tt`} className="mb-1 font-medium text-ink">
            {data[hover].title ?? data[hover].label}
          </p>
          {series.map((s) => (
            <TooltipRow key={s.key} color={series.length > 1 ? s.color : undefined} label={s.label} value={format(data[hover].values[s.key] ?? 0)} />
          ))}
          {series.length > 1 && <TooltipRow label="Total" value={format(totals[hover])} />}
        </Tooltip>
      )}
    </div>
  );
}

// ── single-series line with area wash ───────────────────────────

export function LineChart({
  data,
  color = "var(--viz-1)",
  height = 200,
  format = (v) => String(v),
  ariaLabel,
  seriesLabel,
}: {
  data: { label: string; title?: string; value: number }[];
  color?: string;
  height?: number;
  format?: (v: number) => string;
  ariaLabel: string;
  seriesLabel: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useWidth(wrap);
  const [hover, setHover] = useState<number | null>(null);
  const gradId = useId();

  const pad = { top: 16, right: 44, bottom: 26, left: 44 };
  const innerW = Math.max(10, width - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const { max, ticks: lineTicks } = niceScale(Math.max(...data.map((d) => d.value), 0));
  const x = (i: number) => pad.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / max) * innerH;

  const line = useMemo(() => data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.value)}`).join(""), [data, width, max]); // eslint-disable-line react-hooks/exhaustive-deps
  const area = `${line}L${x(data.length - 1)},${pad.top + innerH}L${x(0)},${pad.top + innerH}Z`;
  const last = data[data.length - 1];

  return (
    <div ref={wrap} className="relative">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        className="block overflow-visible focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        onPointerMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = e.clientX - rect.left - pad.left;
          const i = Math.round((px / innerW) * (data.length - 1));
          setHover(Math.max(0, Math.min(data.length - 1, i)));
        }}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") setHover((h) => Math.min(data.length - 1, (h ?? -1) + 1));
          if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? data.length) - 1));
        }}
        onBlur={() => setHover(null)}
      >
        {lineTicks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={pad.left + innerW} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="tnum fill-ink-3 text-[11px]">
              {format(t)}
            </text>
          </g>
        ))}
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity={0.12} />
            <stop offset="1" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <text key={d.label} x={x(i)} y={height - 8} textAnchor="middle" className="fill-ink-3 text-[11px]">
            {d.label}
          </text>
        ))}
        {/* end marker + direct label */}
        {last && (
          <g>
            <circle cx={x(data.length - 1)} cy={y(last.value)} r={5} fill={color} stroke="var(--surface)" strokeWidth={2} />
            <text x={x(data.length - 1) + 9} y={y(last.value)} dy="0.32em" className="tnum fill-ink text-[11.5px] font-semibold">
              {format(last.value)}
            </text>
          </g>
        )}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + innerH} stroke="var(--ink-3)" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(data[hover].value)} r={5} fill={color} stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
        <line x1={pad.left} x2={pad.left + innerW} y1={pad.top + innerH} y2={pad.top + innerH} stroke="var(--line-strong)" />
      </svg>
      {hover !== null && (
        <Tooltip x={x(hover)} y={y(data[hover].value)} width={width}>
          <p className="mb-1 font-medium text-ink">{data[hover].title ?? data[hover].label}</p>
          <TooltipRow label={seriesLabel} value={format(data[hover].value)} />
        </Tooltip>
      )}
    </div>
  );
}

// ── sparkline ───────────────────────────────────────────────────

/** Tiny trend line: history in a quiet ink, the latest point in the accent. */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  min: minProp,
  max: maxProp,
  reference,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  min?: number;
  max?: number;
  /** Draws a hairline at this value (e.g. a threshold) */
  reference?: number;
  label: string;
}) {
  if (values.length === 0) return null;
  const lo = Math.min(minProp ?? Math.min(...values), reference ?? Infinity);
  const hi = Math.max(maxProp ?? Math.max(...values), reference ?? -Infinity);
  const span = hi - lo || 1;
  const px = (i: number) => 3 + (i / Math.max(1, values.length - 1)) * (width - 6);
  const py = (v: number) => 3 + (1 - (v - lo) / span) * (height - 6);
  const d = values.map((v, i) => `${i ? "L" : "M"}${px(i)},${py(v)}`).join("");
  return (
    <svg width={width} height={height} role="img" aria-label={label} className="overflow-visible">
      {reference !== undefined && <line x1={0} x2={width} y1={py(reference)} y2={py(reference)} stroke="var(--line-strong)" strokeDasharray="0" strokeWidth={1} />}
      <path d={d} fill="none" stroke="var(--ink-3)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={px(values.length - 1)} cy={py(values[values.length - 1])} r={3} fill="var(--accent)" stroke="var(--surface)" strokeWidth={1.5} />
    </svg>
  );
}
