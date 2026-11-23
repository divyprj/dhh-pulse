import type { DeltaBadgeProps } from "@/types/contracts";

/* ==========================================================================
   Display formatters — the single source of numeric typography.
   Locale is pinned to en-US so server render and client hydration agree.
   ========================================================================== */

const COMPACT = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const GROUPED = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

/** 1_284_000 → "1.3M" · 12_400 → "12.4K" */
export function formatCompact(value: number): string {
  return COMPACT.format(finite(value));
}

/** 1_284_000 → "1,284,000" */
export function formatNumber(value: number): string {
  return GROUPED.format(finite(value));
}

/** +12.4K · −3,208 · 0 */
export function formatSigned(value: number): string {
  const n = finite(value);
  if (n === 0) return "0";
  const abs = Math.abs(n) >= 10_000 ? COMPACT.format(Math.abs(n)) : GROUPED.format(Math.abs(n));
  return `${n > 0 ? "+" : "−"}${abs}`;
}

/** 0.1234 → "12.3%" */
export function formatPercent(value: number, digits = 1): string {
  return `${finite(value).toFixed(digits)}%`;
}

/** Percent change between two totals, guarded against divide-by-zero. */
export function percentChange(current: number, previous: number): number {
  const prev = finite(previous);
  if (prev === 0) return 0;
  return ((finite(current) - prev) / Math.abs(prev)) * 100;
}

/** "2026-11-23" → "23 Nov 2026" (stable across server/client). */
export function formatSnapshotDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

/** "2026-11-23" → "23 Nov" — chart axis density. */
export function formatShortDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(parsed);
}

/** Class string joiner — falsy values are dropped. */
export function cx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}

/* ==========================================================================
   Chart axis scale — "nice" steps so two ticks can never print one label.
   ========================================================================== */

export interface AxisScale {
  /** Fixed extent handed to Recharts so the plotted domain matches the ticks. */
  domain: number[];
  ticks: number[];
  /** Label formatter with exactly the precision the step needs. */
  format: (value: number) => string;
}

function niceStep(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  const exponent = Math.floor(Math.log10(raw));
  const base = 10 ** exponent;
  const fraction = raw / base;
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * base;
}

function stepFormatter(step: number, extent: number): (value: number) => string {
  const magnitude = Math.abs(step) || 1;
  // Unit comes from the axis extent so a 9.7M series reads 9.5M, not 9500K.
  const reach = Math.abs(extent) || magnitude;
  const scale = reach >= 1e6 ? 1e6 : reach >= 1e3 ? 1e3 : 1;
  const suffix = scale === 1e6 ? "M" : scale === 1e3 ? "K" : "";
  const decimals = Math.max(0, Math.min(3, Math.ceil(-Math.log10(magnitude / scale))));

  return (value: number) => {
    if (value === 0) return "0";
    const scaled = value / scale;
    return `${scaled.toFixed(decimals)}${suffix}`;
  };
}

/**
 * Derives a padded, evenly spaced axis from raw series values.
 * Returns `null` when there is nothing finite to plot.
 */
export function buildAxisScale(
  values: readonly number[],
  targetTicks = 5,
  includeZero = false
): AxisScale | null {
  const finiteValues = values.filter((value) => Number.isFinite(value));
  if (finiteValues.length === 0) return null;

  let min = includeZero ? Math.min(0, ...finiteValues) : Math.min(...finiteValues);
  let max = Math.max(...finiteValues);

  if (min === max) {
    const pad = Math.abs(min) * 0.03 || 1;
    min -= pad;
    max += pad;
  }

  const step = niceStep((max - min) / Math.max(1, targetTicks));
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;

  const ticks: number[] = [];
  for (let value = start; value <= end + step * 0.5; value += step) {
    // Round away float drift so ticks read as 2.5M, never 2.4999999999M.
    ticks.push(Number((Math.round(value / step) * step).toFixed(6)));
  }

  return { domain: [start, end], ticks, format: stepFormatter(step, Math.max(Math.abs(start), Math.abs(end))) };
}

/* ==========================================================================
   DeltaBadge
   ========================================================================== */

const SIZES: Record<DeltaBadgeProps["size"], string> = {
  sm: "h-5 gap-1 px-1.5 text-[10px]",
  md: "h-6 gap-1 px-2 text-[11px]",
  lg: "h-8 gap-1.5 px-2.5 text-[13px]",
};

const ARROWS = { up: "▲", down: "▼", flat: "—" } as const;

/**
 * DeltaBadge — signed movement chip.
 *
 * Positive is emerald, negative is rose, flat is steel. The arrow carries the
 * same information as the colour so the badge survives greyscale and
 * colour-vision deficiency.
 */
export function DeltaBadge({ value, format, size }: DeltaBadgeProps) {
  const n = finite(value);
  const nearest = format === "percent" ? Number(n.toFixed(1)) : Math.round(n);
  const direction = nearest > 0 ? "up" : nearest < 0 ? "down" : "flat";

  const tone =
    direction === "up"
      ? "border-gain/30 bg-gain/[0.07] text-gain"
      : direction === "down"
        ? "border-loss/30 bg-loss/[0.07] text-loss"
        : "border-hairline bg-riser/50 text-dim";

  const absolute =
    format === "percent"
      ? `${Math.abs(nearest).toFixed(1)}%`
      : Math.abs(nearest) >= 10_000
        ? COMPACT.format(Math.abs(nearest))
        : GROUPED.format(Math.abs(nearest));

  const sign = direction === "up" ? "+" : direction === "down" ? "−" : "";

  const spoken = `${direction === "flat" ? "no" : direction === "up" ? "positive" : "negative"} change of ${absolute}${
    format === "percent" ? " percent" : ""
  }`;

  return (
    <span
      role="img"
      aria-label={spoken}
      title={spoken}
      data-tone={direction}
      className={cx(
        "inline-flex max-w-full shrink-0 items-center justify-center whitespace-nowrap rounded-[2px] border font-mono font-medium tabular-nums",
        SIZES[size],
        tone
      )}
    >
      <span aria-hidden="true" className="text-[0.72em] leading-none">
        {ARROWS[direction]}
      </span>
      <span aria-hidden="true" className="leading-none">
        {sign}
        {absolute}
      </span>
    </span>
  );
}
