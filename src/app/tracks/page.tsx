import type { Metadata } from "next";
import { Suspense } from "react";
import { getTopGainerTracks } from "@/lib/analytics/leaderboard";
import type { TopGainerTracksResponse } from "@/types/contracts";
import { TrackTable } from "@/components/leaderboard/TrackTable";
import { ErrorState, Skeleton, SkeletonStat } from "@/components/ui";
import {
  formatCompact,
  formatNumber,
  formatSnapshotDate,
  formatPercent,
} from "@/components/leaderboard/DeltaBadge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Track heat",
  description:
    "The fastest gaining tracks in Desi Hip Hop, ranked by 24-hour stream gain across the scene.",
};

export default function TracksPage() {
  return (
    <Suspense fallback={<TracksSkeleton />}>
      <TracksBody />
    </Suspense>
  );
}

async function TracksBody() {
  let data: TopGainerTracksResponse;
  try {
    data = getTopGainerTracks({ limit: 100, offset: 0 });
  } catch (error) {
    return (
      <div className="rise">
        <Header summary={null} />
        <div className="mt-5">
          <ErrorState
            title="The gainers ledger could not be read"
            description="Track deltas are computed from two snapshot days. The store did not answer the delta query."
            detail={error instanceof Error ? error.message : String(error)}
          />
        </div>
      </div>
    );
  }

  const entries = data.entries;
  const totalGain = entries.reduce((sum, entry) => sum + entry.track.dailyStreams, 0);
  const gaining = entries.filter((entry) => entry.track.dailyStreams > 0).length;
  const peak = entries[0]?.track.dailyStreams ?? 0;
  const topFiveShare =
    totalGain > 0
      ? (entries
          .slice(0, 5)
          .reduce((sum, entry) => sum + entry.track.dailyStreams, 0) /
          totalGain) *
        100
      : 0;
  const snapshotDate = entries[0]?.track.snapshotDate ?? null;

  return (
    <div>
      <Header
        summary={{
          snapshotDate,
          total: data.total,
          totalGain,
          gaining,
          peak,
          topFiveShare,
        }}
      />

      <div className="mt-4">
        <TrackTable entries={entries} isLoading={false} />
      </div>

      <p className="mt-3 max-w-[80ch] font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-dim">
        Gains are clamped at zero. A playcount that moves backwards is treated as
        a metadata migration, never as negative listening.
      </p>
    </div>
  );
}

function Header({
  summary,
}: {
  summary: {
    snapshotDate: string | null;
    total: number;
    totalGain: number;
    gaining: number;
    peak: number;
    topFiveShare: number;
  } | null;
}) {
  return (
    <div className="rise">
      <div className="flex flex-col gap-4 border-b border-hairline pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Scene-wide / 24h deltas</p>
          <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-chalk">
            Track heat
          </h1>
          <p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-ash">
            Every track in the tracked catalog, ranked by exact 24-hour stream
            gain. Lifetime playcount sits beside the gain for scale — a 40-year
            catalog and a fresh single are compared on the same axis.
          </p>
        </div>

        <dl className="flex shrink-0 flex-wrap gap-x-6 gap-y-2 sm:justify-end">
          <div>
            <dt className="eyebrow">Snapshot</dt>
            <dd className="mt-1 font-mono text-[12px] text-chalk">
              {summary?.snapshotDate ? formatSnapshotDate(summary.snapshotDate) : "—"}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Tracks ranked</dt>
            <dd className="mt-1 font-mono text-[12px] text-chalk tabular-nums">
              {summary ? formatNumber(summary.total) : "—"}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px border border-hairline bg-hairline sm:grid-cols-4">
        <div className="bg-deck px-4 py-3.5">
          <p className="eyebrow">Track gain total</p>
          <p className="mt-2 font-mono text-[20px] leading-none tabular-nums text-chalk">
            {summary ? formatNumber(summary.totalGain) : "—"}
          </p>
        </div>
        <div className="bg-deck px-4 py-3.5">
          <p className="eyebrow">Tracks moving</p>
          <p className="mt-2 font-mono text-[20px] leading-none tabular-nums text-chalk">
            {summary ? formatCompact(summary.gaining) : "—"}
          </p>
        </div>
        <div className="bg-deck px-4 py-3.5">
          <p className="eyebrow">Peak track gain</p>
          <p className="mt-2 font-mono text-[20px] leading-none tabular-nums text-signal">
            {summary ? formatCompact(summary.peak) : "—"}
          </p>
        </div>
        <div className="bg-deck px-4 py-3.5">
          <p className="eyebrow">Top 5 concentration</p>
          <p className="mt-2 font-mono text-[20px] leading-none tabular-nums text-chalk">
            {summary ? formatPercent(summary.topFiveShare) : "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function TracksSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading track heat">
      <div className="space-y-3 border-b border-hairline pb-5">
        <Skeleton className="h-2 w-36" />
        <Skeleton className="h-8 w-56 max-w-full" />
        <Skeleton className="h-3 w-full max-w-xl" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-px border border-hairline bg-hairline sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-deck px-4 py-3.5">
            <SkeletonStat valueClassName="h-5 w-24" />
          </div>
        ))}
      </div>
      <div className="panel mt-4 p-4">
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, row) => (
            <div key={row} className="flex items-center gap-4">
              <Skeleton className="h-3 w-6" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-2 w-1/3" />
              </div>
              <Skeleton className="h-4 w-16" />
              <Skeleton className="hidden h-4 w-16 sm:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
