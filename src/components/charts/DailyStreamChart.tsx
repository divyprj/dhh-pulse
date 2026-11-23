"use client";

import { useId, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyStreamChartProps } from "@/types/contracts";
import { EmptyState } from "@/components/ui";
import {
  buildAxisScale,
  formatCompact,
  formatNumber,
  formatShortDate,
} from "@/components/leaderboard/DeltaBadge";

function BarTooltip({
  active,
  payload,
  label,
  artistName,
}: {
  active?: boolean;
  payload?: readonly { value?: number | string }[];
  label?: string | number;
  artistName: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0]?.value;

  return (
    <div className="panel min-w-[170px] max-w-[280px] p-3 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
        {typeof label === "string" ? formatShortDate(label) : label}
      </p>
      <p className="mt-2 font-mono text-lg leading-none tabular-nums text-chalk">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
      <p className="mt-1.5 max-w-[24ch] truncate text-[10px] uppercase tracking-[0.1em] text-dim">
        {artistName}
      </p>
    </div>
  );
}

/**
 * DailyStreamChart — catalog-wide daily stream bars for one artist.
 *
 * Gaps are real (a missing snapshot day stays missing), so bars are drawn from
 * the recorded series only. No animation; the panel handles entrance motion.
 */
export function DailyStreamChart({
  data,
  artistName,
  height = 260,
}: DailyStreamChartProps) {
  const gradientId = `stream-fill-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  /** Bars start at zero and share one nice scale, so no tick label repeats. */
  const axis = useMemo(
    () => buildAxisScale(data.map((point) => point.value), 4, true),
    [data]
  );

  if (data.length === 0) {
    return (
      <EmptyState
        compact
        icon="tape"
        eyebrow="Daily stream series"
        title="No daily stream history yet"
        description="Daily streams are derived by diffing consecutive playcount snapshots. Once two days are on file, this deck starts printing bars."
      />
    );
  }

  const total = data.reduce((sum, point) => sum + point.value, 0);
  const peak = data.reduce((max, point) => Math.max(max, point.value), 0);

  return (
    <figure className="m-0 w-full">
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data as unknown as Array<{ date: string; value: number }>}
            margin={{ top: 8, right: 10, bottom: 0, left: -14 }}
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FFB020" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#FFB020" stopOpacity={0.28} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="#22222A"
              strokeDasharray="2 5"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => formatShortDate(value)}
              tickLine={false}
              axisLine={{ stroke: "#26262D" }}
              tick={{ fill: "#9A9AA4" }}
              minTickGap={24}
              interval="preserveStartEnd"
              height={28}
            />
            <YAxis
              tickFormatter={(value: number) =>
                axis ? axis.format(value) : formatCompact(value)
              }
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#9A9AA4" }}
              width={54}
              domain={axis ? axis.domain : [0, "auto"]}
              ticks={axis ? axis.ticks : undefined}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.035)" }}
              content={({ active, payload, label }) => (
                <BarTooltip
                  active={active}
                  payload={payload as readonly { value?: number | string }[] | undefined}
                  label={label}
                  artistName={artistName}
                />
              )}
            />
            <Bar
              dataKey="value"
              name="Daily streams"
              fill={`url(#${gradientId})`}
              stroke="#FFB020"
              strokeOpacity={0.55}
              strokeWidth={1}
              maxBarSize={22}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <figcaption className="sr-only">
        {artistName} daily streams across {data.length} snapshot
        {data.length === 1 ? "" : "s"}. Peak {formatNumber(peak)} streams, total{" "}
        {formatNumber(total)}.
      </figcaption>
    </figure>
  );
}
