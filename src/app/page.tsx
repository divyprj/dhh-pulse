import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getLeaderboard, getTopGainerTracks } from "@/lib/analytics/leaderboard";
import { getDb } from "@/lib/db/client";
import type {
  LeaderboardResponse,
  SnapshotDate,
  TopGainerTracksResponse,
} from "@/types/contracts";
import { EmptyState, ErrorState, Skeleton, SkeletonStat } from "@/components/ui";
import {
  DeltaBadge,
  formatCompact,
  formatNumber,
  formatSnapshotDate,
  percentChange,
} from "@/components/leaderboard/DeltaBadge";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Scene ledger",
  description:
    "Scene-wide 24-hour stream output, artist momentum, and top gainer tracks for Desi Hip Hop.",
};

interface ScrapeRunRow {
  status: string;
  started_at: number;
  completed_at: number | null;
  total_artists: number;
  success_count: number | null;
  failure_count: number | null;
}

interface DashboardData {
  leaderboard: LeaderboardResponse;
  topTracks: TopGainerTracksResponse;
  lastRun: ScrapeRunRow | null;
}

function formatTimestamp(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(ms));
}

/** Humanised run length — 34s, 2m 14s, 1h 06m. */
function formatDuration(ms: number): string {
  const totalSeconds = Math.max(1, Math.round(ms / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${String(seconds).padStart(2, "0")}s`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

function readLastRun(): ScrapeRunRow | null {
  try {
    const row = getDb()
      .prepare(
        `SELECT status, started_at, completed_at, total_artists, success_count, failure_count
         FROM scrape_runs
         ORDER BY started_at DESC
         LIMIT 1`
      )
      .get() as ScrapeRunRow | undefined;
    return row ?? null;
  } catch {
    return null;
  }
}

async function loadDashboard(): Promise<DashboardData> {
  const leaderboard = getLeaderboard({
    sortBy: "totalDailyStreams",
    direction: "desc",
    limit: 200,
    offset: 0,
  });

  const topTracks = getTopGainerTracks({ limit: 5, offset: 0 });
  const lastRun = readLastRun();

  return { leaderboard, topTracks, lastRun };
}

/* -------------------------------------------------------------------------- */
/* Small building blocks                                                       */
/* -------------------------------------------------------------------------- */

function Stat({
  label,
  value,
  hint,
  className = "",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`px-4 py-3.5 ${className}`}>
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-dim">{label}</p>
      <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="min-w-0 max-w-full font-mono text-[17px] leading-none text-chalk tabular-nums">
          {value}
        </span>
        {hint}
      </div>
    </div>
  );
}

function SectionMeta({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-dim">
      {children}
    </span>
  );
}

function Avatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        width={34}
        height={34}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="h-[34px] w-[34px] shrink-0 border border-hairline object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid h-[34px] w-[34px] shrink-0 place-items-center border border-hairline bg-riser font-mono text-[12px] text-signal"
    >
      {initial}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardBody />
    </Suspense>
  );
}

async function DashboardBody() {
  let data: DashboardData;
  try {
    data = await loadDashboard();
  } catch (error) {
    return (
      <div className="rise">
        <ErrorState
          title="The scene ledger could not be read"
          description="The snapshot store refused the leaderboard query. The console is still up — read again once the database is reachable."
          detail={error instanceof Error ? error.message : String(error)}
        />
      </div>
    );
  }

  const { leaderboard, topTracks, lastRun } = data;
  const entries = leaderboard.entries;

  if (entries.length === 0) {
    return (
      <div className="rise">
        <Header snapshotDate={null} artistCount={0} trackCount={0} />
        <div className="panel mt-5">
          <EmptyState
            icon="tape"
            eyebrow="Cold start"
            title="The deck is loaded — no tape has run yet"
            description="DHH Pulse ranks artists from daily snapshots. There are zero snapshots in the store, so the scene has nothing to rank. A full catalog sync walks the registry sequentially and writes artist plus track playcounts as it goes."
            action={
              <p className="border border-hairline bg-void/60 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ash">
                Trigger <span className="text-signal">Sync scene</span> in the command bar
              </p>
            }
          />
        </div>
      </div>
    );
  }

  const totals = entries.reduce(
    (acc, entry) => {
      acc.dailyStreams += entry.artist.totalDailyStreams;
      acc.listeners += entry.artist.monthlyListeners;
      acc.followers += entry.artist.followers;
      acc.listenerDelta += entry.artist.listenerDelta;
      acc.tracks += entry.artist.trackCount;
      return acc;
    },
    { dailyStreams: 0, listeners: 0, followers: 0, listenerDelta: 0, tracks: 0 }
  );

  const previousListeners = totals.listeners - totals.listenerDelta;
  const listenerChange = percentChange(totals.listeners, previousListeners);

  const topArtists = entries.slice(0, 5);
  const maxStreams = topArtists[0]?.artist.totalDailyStreams ?? 1;

  const biggestMover = entries.reduce(
    (best, entry) =>
      entry.artist.listenerDelta > best.artist.listenerDelta ? entry : best,
    entries[0]
  );

  const snapshotDate = entries[0].artist.snapshotDate;

  return (
    <div>
      <Header
        snapshotDate={snapshotDate}
        artistCount={leaderboard.total}
        trackCount={totals.tracks}
      />

      {/* Scene output console ------------------------------------------- */}
      <section
        aria-labelledby="scene-output"
        className="console rise mt-5"
        style={{ animationDelay: "40ms" }}
      >
        <div className="flex flex-col gap-6 p-4 sm:p-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <h2 id="scene-output" className="eyebrow">
              Scene 24h output
            </h2>
            <p
              className="mt-3 font-mono text-[clamp(2.125rem,8vw,4.5rem)] font-semibold leading-[0.9] tracking-[-0.045em] tabular-nums text-chalk"
              title={`${formatNumber(totals.dailyStreams)} streams in the last 24 hours`}
            >
              {formatNumber(totals.dailyStreams)}
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-dim">
              streams · {leaderboard.total} artists ranked ·{" "}
              {formatNumber(totals.tracks)} tracks in catalog
            </p>
          </div>

          <dl className="grid w-full max-w-md shrink-0 grid-cols-2 gap-px border border-hairline bg-hairline">
            <div className="bg-deck px-4 py-3.5">
              <dt className="eyebrow">Monthly listeners</dt>
              <dd className="mt-2 font-mono text-[22px] leading-none tabular-nums text-chalk">
                {formatCompact(totals.listeners)}
              </dd>
            </div>
            <div className="bg-deck px-4 py-3.5">
              <dt className="eyebrow">Followers</dt>
              <dd className="mt-2 font-mono text-[22px] leading-none tabular-nums text-chalk">
                {formatCompact(totals.followers)}
              </dd>
            </div>
            <div className="bg-deck px-4 py-3.5">
              <dt className="eyebrow">Net listener Δ</dt>
              <dd className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-mono text-[22px] leading-none tabular-nums text-chalk">
                  {formatCompact(totals.listenerDelta)}
                </span>
                <DeltaBadge
                  value={listenerChange}
                  format="percent"
                  size="sm"
                />
              </dd>
            </div>
            <div className="bg-deck px-4 py-3.5">
              <dt className="eyebrow">Snapshot date</dt>
              <dd className="mt-2 font-mono text-[13px] leading-none text-ash">
                {formatSnapshotDate(snapshotDate)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="deck-rule" aria-hidden="true" />

        <div className="grid grid-cols-2 divide-x divide-hairline border-t border-hairline sm:grid-cols-4">
          <Stat
            label="Avg / ranked artist"
            value={formatCompact(totals.dailyStreams / Math.max(1, leaderboard.total))}
            hint={<span className="font-mono text-[9px] uppercase text-dim">24h</span>}
          />
          <Stat
            label="Biggest mover"
            value={
              <Link
                href={`/artists/${biggestMover.artist.spotifyId}`}
                className="tactile inline-block min-h-11 min-w-11 max-w-full truncate align-middle leading-[2.75] text-chalk hover:text-signal sm:max-w-[22ch]"
                title={biggestMover.artist.name}
              >
                {biggestMover.artist.name}
              </Link>
            }
            hint={
              <DeltaBadge
                value={biggestMover.artist.listenerDelta}
                format="number"
                size="sm"
              />
            }
            className="border-t border-hairline sm:border-t-0"
          />
          <Stat
            label="Top gainer track"
            value={
              <span
                className="block max-w-[18ch] truncate align-middle leading-[2.75] text-chalk"
                title={topTracks.entries[0]?.track.trackName ?? "—"}
              >
                {topTracks.entries[0]?.track.trackName ?? "—"}
              </span>
            }
            hint={
              topTracks.entries[0] ? (
                <span className="font-mono text-[10px] text-signal">
                  {formatCompact(topTracks.entries[0].track.dailyStreams)}
                </span>
              ) : undefined
            }
            className="border-t border-hairline sm:border-t-0"
          />
          <Stat
            label="Last sync"
            value={
              <span className="font-mono text-[12px] uppercase tracking-[0.08em] text-ash">
                {lastRun ? formatTimestamp(lastRun.started_at) : "Never"}
              </span>
            }
            hint={
              lastRun ? (
                <span
                  className={`font-mono text-[9px] uppercase tracking-[0.12em] ${
                    lastRun.status === "completed"
                      ? "text-gain"
                      : lastRun.status === "running"
                        ? "text-signal"
                        : "text-loss"
                  }`}
                >
                  {lastRun.status}
                </span>
              ) : undefined
            }
            className="border-t border-hairline sm:border-t-0"
          />
        </div>
      </section>

      {/* Momentum + heat ----------------------------------------------- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section
          aria-labelledby="artist-momentum"
          className="panel rise overflow-hidden"
          style={{ animationDelay: "90ms" }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[9px] text-signal">01</span>
              <h2
                id="artist-momentum"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash"
              >
                Artist momentum
              </h2>
            </div>
            <Link
              href="/artists"
              className="tactile inline-flex min-h-11 items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-dim hover:text-signal"
            >
              Full ledger
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <ol>
            {topArtists.map((entry, index) => {
              const pct = Math.max(
                4,
                Math.round((entry.artist.totalDailyStreams / maxStreams) * 100)
              );
              return (
                <li
                  key={entry.artist.spotifyId}
                  className="border-b border-hairline/70 last:border-b-0"
                >
                  <Link
                    href={`/artists/${entry.artist.spotifyId}`}
                    className="group flex min-h-[68px] items-center gap-3 px-4 py-3 active:bg-riser"
                  >
                    <span
                      className={`w-6 shrink-0 font-mono text-[11px] tabular-nums ${
                        index < 3 ? "text-signal" : "text-dim"
                      }`}
                    >
                      {String(entry.rank).padStart(2, "0")}
                    </span>
                    <Avatar
                      name={entry.artist.name}
                      imageUrl={entry.artist.imageUrl}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-chalk group-hover:text-signal">
                        {entry.artist.name}
                      </span>
                      <span
                        aria-hidden="true"
                        className="mt-2 block h-[3px] w-full overflow-hidden bg-hairline"
                      >
                        <span
                          className="block h-full bg-signal/75"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-[14px] leading-none text-chalk tabular-nums">
                        {formatCompact(entry.artist.totalDailyStreams)}
                      </span>
                      <span className="mt-1.5 block font-mono text-[9px] uppercase tracking-[0.12em] text-dim">
                        24h
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <section
          aria-labelledby="track-heat"
          className="panel rise overflow-hidden"
          style={{ animationDelay: "130ms" }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[9px] text-signal">02</span>
              <h2
                id="track-heat"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash"
              >
                Track heat
              </h2>
            </div>
            <Link
              href="/tracks"
              className="tactile inline-flex min-h-11 items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-dim hover:text-signal"
            >
              All gainers
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          {topTracks.entries.length === 0 ? (
            <EmptyState
              compact
              icon="tape"
              eyebrow="No gainers"
              title="No track movement to rank"
              description="Daily gains need two consecutive snapshot days before a track can appear here."
            />
          ) : (
            <ol>
              {topTracks.entries.map((entry, index) => (
                <li
                  key={`${entry.track.trackId}-${entry.rank}`}
                  className="border-b border-hairline/70 last:border-b-0"
                >
                  <Link
                    href={`/artists/${entry.track.artistId}`}
                    className="group flex min-h-[68px] items-center gap-3 px-4 py-3 active:bg-riser"
                  >
                    <span
                      className={`w-6 shrink-0 font-mono text-[11px] tabular-nums ${
                        index < 3 ? "text-signal" : "text-dim"
                      }`}
                    >
                      {String(entry.rank).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-[13px] font-medium leading-tight text-chalk group-hover:text-signal"
                        title={entry.track.trackName}
                      >
                        {entry.track.trackName}
                      </span>
                      <span className="mt-1 flex min-w-0 font-mono text-[10px] uppercase tracking-[0.08em] text-dim">
                        <span className="shrink-0 text-ash">
                          {entry.track.artistName}
                        </span>
                        <span aria-hidden="true" className="px-1.5">
                          /
                        </span>
                        <span className="min-w-0 truncate normal-case tracking-normal">
                          {entry.track.albumName}
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className="block font-mono text-[14px] leading-none text-chalk tabular-nums"
                        title={`${formatNumber(entry.track.dailyStreams)} streams in 24h`}
                      >
                        {formatCompact(entry.track.dailyStreams)}
                      </span>
                      <span className="mt-1.5 block font-mono text-[9px] uppercase tracking-[0.12em] text-dim">
                        24h gain
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* Operator strip -------------------------------------------------- */}
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section
          aria-labelledby="mover-detail"
          className="panel rise"
          style={{ animationDelay: "170ms" }}
        >
          <div className="flex items-center gap-3 border-b border-hairline px-4 py-3">
            <span className="font-mono text-[9px] text-signal">03</span>
            <h2
              id="mover-detail"
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash"
            >
              Largest audience jump
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-4 p-4">
            <Avatar
              name={biggestMover.artist.name}
              imageUrl={biggestMover.artist.imageUrl}
            />
            <div className="min-w-0 flex-1">
              <Link
                href={`/artists/${biggestMover.artist.spotifyId}`}
                className="block min-h-11 truncate text-[15px] font-medium leading-[2.75] text-chalk hover:text-signal"
                title={biggestMover.artist.name}
              >
                {biggestMover.artist.name}
              </Link>
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-dim">
                {formatCompact(biggestMover.artist.monthlyListeners)} monthly ·{" "}
                {formatCompact(biggestMover.artist.followers)} followers
              </p>
            </div>
            <DeltaBadge
              value={biggestMover.artist.listenerDelta}
              format="number"
              size="lg"
            />
          </div>
          <div className="grid grid-cols-2 gap-px border-t border-hairline bg-hairline">
            <Stat
              label="Top track"
              value={
                <span
                  className="block max-w-[22ch] truncate leading-[2.75]"
                  title={biggestMover.artist.topTrack?.name ?? "—"}
                >
                  {biggestMover.artist.topTrack?.name ?? "—"}
                </span>
              }
            />
            <Stat
              label="Track 24h"
              value={
                biggestMover.artist.topTrack ? (
                  formatCompact(biggestMover.artist.topTrack.dailyStreams)
                ) : (
                  "—"
                )
              }
            />
          </div>
        </section>

        <section
          aria-labelledby="sync-ledger"
          className="panel rise"
          style={{ animationDelay: "210ms" }}
        >
          <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="font-mono text-[9px] text-signal">04</span>
              <h2
                id="sync-ledger"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash"
              >
                Sync ledger
              </h2>
            </div>
            <SectionMeta>SQLite · WAL</SectionMeta>
          </div>

          {lastRun ? (
            <dl className="divide-y divide-hairline/70">
              <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-dim">
                  Status
                </dt>
                <dd
                  className={`font-mono text-[10px] uppercase tracking-[0.12em] ${
                    lastRun.status === "completed"
                      ? "text-gain"
                      : lastRun.status === "running"
                        ? "text-signal"
                        : "text-loss"
                  }`}
                >
                  {lastRun.status}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-dim">
                  Started (UTC)
                </dt>
                <dd className="font-mono text-[10px] text-ash">
                  {formatTimestamp(lastRun.started_at)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-dim">
                  Duration
                </dt>
                <dd className="font-mono text-[10px] text-ash">
                  {lastRun.completed_at
                    ? formatDuration(lastRun.completed_at - lastRun.started_at)
                    : "in flight"}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-dim">
                  Artists
                </dt>
                <dd className="font-mono text-[10px] text-ash tabular-nums">
                  <span className="text-gain">{lastRun.success_count ?? 0} ok</span>
                  <span className="px-1.5 text-dim">·</span>
                  <span className={lastRun.failure_count ? "text-loss" : "text-dim"}>
                    {lastRun.failure_count ?? 0} failed
                  </span>
                  <span className="px-1.5 text-dim">/</span>
                  {lastRun.total_artists} total
                </dd>
              </div>
            </dl>
          ) : (
            <EmptyState
              compact
              icon="signal"
              eyebrow="No sync recorded"
              title="This store has never run a batch"
              description="Every scrape run writes its own audit row. Trigger a sync and the ledger will report status, duration, and per-artist outcomes."
            />
          )}
        </section>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header + loading                                                            */
/* -------------------------------------------------------------------------- */

function Header({
  snapshotDate,
  artistCount,
  trackCount,
}: {
  snapshotDate: SnapshotDate | null;
  artistCount: number;
  trackCount: number;
}) {
  return (
    <div className="rise flex flex-col gap-4 border-b border-hairline pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="eyebrow">Scene intelligence / daily snapshot</p>
        <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-chalk">
          Scene ledger
        </h1>
        <p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-ash">
          Every ranked number below is derived from consecutive playcount
          snapshots — exact lifetime streams diffed across 24 hours, not a
          popularity proxy.
        </p>
      </div>

      <dl className="flex shrink-0 flex-wrap gap-x-6 gap-y-2 sm:justify-end">
        <div>
          <dt className="eyebrow">Snapshot</dt>
          <dd className="mt-1 font-mono text-[12px] text-chalk">
            {snapshotDate ? formatSnapshotDate(snapshotDate) : "—"}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Ranked</dt>
          <dd className="mt-1 font-mono text-[12px] text-chalk tabular-nums">
            {String(artistCount).padStart(2, "0")} artists
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Catalog</dt>
          <dd className="mt-1 font-mono text-[12px] text-chalk tabular-nums">
            {formatCompact(trackCount)} tracks
          </dd>
        </div>
      </dl>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading scene ledger">
      <div className="flex flex-col gap-4 border-b border-hairline pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-xl space-y-3">
          <Skeleton className="h-2 w-40" />
          <Skeleton className="h-8 w-64 max-w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
        <div className="flex gap-6">
          <SkeletonStat valueClassName="h-3 w-20" />
          <SkeletonStat valueClassName="h-3 w-20" />
        </div>
      </div>

      <div className="console mt-5 p-4 sm:p-6">
        <Skeleton className="h-2 w-32" />
        <Skeleton className="mt-4 h-12 w-72 max-w-full" />
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <SkeletonStat key={index} valueClassName="h-5 w-24" />
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, panel) => (
          <div key={panel} className="panel p-4">
            <Skeleton className="h-2.5 w-28" />
            <div className="mt-4 space-y-4">
              {Array.from({ length: 5 }).map((__, row) => (
                <div key={row} className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-2.5 w-2/3" />
                    <Skeleton className="h-1.5 w-full" />
                  </div>
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
