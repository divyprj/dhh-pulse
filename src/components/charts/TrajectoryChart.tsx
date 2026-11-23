"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrajectoryChartProps } from "@/types/contracts";
import { EmptyState } from "@/components/ui";
import {
  buildAxisScale,
  formatCompact,
  formatNumber,
  formatShortDate,
} from "@/components/leaderboard/DeltaBadge";

/**
 * Studio-safe series colours. Amber leads, emerald confirms, chalk neutrals
 * carry comparison lines. No purple, no blue SaaS gradient.
 */
const SERIES_COLORS = [
  "#FFB020",
  "#34D399",
  "#F2F2EF",
  "#FB7185",
  "#A2A2AB",
  "#38BDF8",
];

const METRIC_LABEL: Record<TrajectoryChartProps["metric"], string> = {
  monthlyListeners: "Monthly listeners",
  followers: "Followers",
  totalDailyStreams: "24h streams",
};

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
  metricLabel,
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: string | number;
  metricLabel: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="panel min-w-[180px] max-w-[280px] p-3 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
        {typeof label === "string" ? formatShortDate(label) : label}
      </p>
      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-dim">
        {metricLabel}
      </p>
      <ul className="mt-2 space-y-1.5">
        {payload.map((entry, index) => (
          <li
            key={`${entry.name ?? "series"}-${index}`}
            className="flex items-center justify-between gap-4"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="block h-1.5 w-1.5 shrink-0"
                style={{ backgroundColor: entry.color ?? "#FFB020" }}
              />
              <span className="truncate text-[11px] text-ash">{entry.name}</span>
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-chalk">
              {typeof entry.value === "number" ? formatNumber(entry.value) : entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * TrajectoryChart — comparative time-series for one metric across artists.
 *
 * Chart animation is disabled on purpose: the surrounding panel owns the
 * entrance transform, so the plot never repaints geometry frame-by-frame.
 */
export function TrajectoryChart({
  trajectories,
  metric,
  height = 260,
}: TrajectoryChartProps) {
  const rows = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string>>();

    for (const trajectory of trajectories) {
      for (const point of trajectory.dataPoints) {
        const row = byDate.get(point.date) ?? { date: point.date };
        row[trajectory.spotifyId] = point.value;
        byDate.set(point.date, row);
      }
    }

    return Array.from(byDate.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
  }, [trajectories]);

  /**
   * One shared, "nice" y-scale across every series. Without it Recharts picks
   * ticks per series and a compact label can repeat (9.7M above 9.7M).
   */
  const axis = useMemo(() => {
    const values: number[] = [];
    for (const row of rows) {
      for (const trajectory of trajectories) {
        const value = row[trajectory.spotifyId];
        if (typeof value === "number") values.push(value);
      }
    }
    return buildAxisScale(values, 5);
  }, [rows, trajectories]);

  const hasHistory = rows.length >= 2;

  if (!hasHistory) {
    return (
      <EmptyState
        compact
        icon="signal"
        eyebrow={`${METRIC_LABEL[metric]} trajectory`}
        title="Not enough history to plot a curve"
        description="Trajectory lines need at least two daily snapshots. Keep the 24h job running and this chart becomes the trend line."
      />
    );
  }

  const first = rows[0];
  const last = rows[rows.length - 1];
  const summary = trajectories
    .map((trajectory) => {
      const start = first[trajectory.spotifyId];
      const end = last[trajectory.spotifyId];
      if (typeof start !== "number" || typeof end !== "number") return null;
      return `${trajectory.name}: ${formatNumber(start)} to ${formatNumber(end)}`;
    })
    .filter(Boolean)
    .join("; ");

  return (
    <figure className="m-0 w-full">
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {trajectories.map((trajectory, index) => (
          <span
            key={trajectory.spotifyId}
            className="flex min-w-0 items-center gap-1.5"
          >
            <span
              aria-hidden="true"
              className="block h-1.5 w-1.5 shrink-0"
              style={{
                backgroundColor: SERIES_COLORS[index % SERIES_COLORS.length],
              }}
            />
            <span className="truncate font-mono text-[10px] uppercase tracking-[0.1em] text-ash">
              {trajectory.name}
            </span>
          </span>
        ))}
      </div>

      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{ top: 6, right: 10, bottom: 0, left: -14 }}
          >
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
              minTickGap={30}
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
              domain={axis ? axis.domain : ["auto", "auto"]}
              ticks={axis ? axis.ticks : undefined}
            />
            <Tooltip
              cursor={{ stroke: "#3A3A44", strokeDasharray: "2 4" }}
              content={({ active, payload, label }) => (
                <ChartTooltip
                  active={active}
                  payload={payload as readonly TooltipEntry[] | undefined}
                  label={label}
                  metricLabel={METRIC_LABEL[metric]}
                />
              )}
            />
            <Legend wrapperStyle={{ display: "none" }} />
            {trajectories.map((trajectory, index) => (
              <Line
                key={trajectory.spotifyId}
                type="monotone"
                dataKey={trajectory.spotifyId}
                name={trajectory.name}
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                strokeWidth={index === 0 ? 2 : 1.4}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <figcaption className="sr-only">
        {METRIC_LABEL[metric]} over {rows.length} snapshots. {summary}
      </figcaption>
    </figure>
  );
}
