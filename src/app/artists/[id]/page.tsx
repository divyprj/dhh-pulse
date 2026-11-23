import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getArtistDetail } from "@/lib/analytics/aggregator";
import type {
  ArtistDetailView,
  TopGainerTrackEntry,
} from "@/types/contracts";
import { toSpotifyArtistId } from "@/types/contracts";
import { TrajectoryChart } from "@/components/charts/TrajectoryChart";
import { DailyStreamChart } from "@/components/charts/DailyStreamChart";
import { TrackTable } from "@/components/leaderboard/TrackTable";
import {
  DeltaBadge,
  formatCompact,
  formatNumber,
  formatPercent,
  formatSnapshotDate,
  percentChange,
} from "@/components/leaderboard/DeltaBadge";
import { EmptyState, ErrorState } from "@/components/ui";

export const dynamic = "force-dynamic";

/** De-duplicated per request: metadata and the page body share one query. */
const loadArtist = cache((id: string) => getArtistDetail(toSpotifyArtistId(id)));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const detail = loadArtist(id);
    if (!detail) return { title: "Artist not found" };
    return {
      title: detail.artist.name,
      description: `${detail.artist.name} — 24-hour streams, monthly listeners, and catalog trajectory on DHH Pulse.`,
    };
  } catch {
    return { title: "Artist" };
  }
}

export default async function ArtistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let detail: ArtistDetailView | null;
  try {
    detail = loadArtist(id);
  } catch (error) {
    return (
      <div className="rise">
        <BackLink />
        <div className="mt-5">
          <ErrorState
            title="This artist profile could not be read"
            description="The analyst query failed against the snapshot store. The artist is still tracked — retry once the database answers."
            detail={error instanceof Error ? error.message : String(error)}
          />
        </div>
      </div>
    );
  }

  if (!detail) notFound();

  const { artist, recentTracks, trajectory, catalogSize } = detail;
  const previousListeners = artist.monthlyListeners - artist.listenerDelta;
  const listenerChange = percentChange(artist.monthlyListeners, previousListeners);
  const streamsPerListener =
    artist.monthlyListeners > 0
      ? artist.totalDailyStreams / artist.monthlyListeners
      : 0;

  const trackEntries: TopGainerTrackEntry[] = recentTracks.map((track, index) => ({
    rank: index + 1,
    track,
  }));

  return (
    <div>
      <BackLink />

      {/* Identity -------------------------------------------------------- */}
      <header
        className="rise mt-4 flex flex-col gap-5 border-b border-hairline pb-5 sm:flex-row sm:items-end sm:justify-between"
        style={{ animationDelay: "30ms" }}
      >
        <div className="flex min-w-0 items-start gap-4">
          {artist.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artist.imageUrl}
              alt=""
              width={64}
              height={64}
              loading="eager"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-16 w-16 shrink-0 border border-hairline object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="grid h-16 w-16 shrink-0 place-items-center border border-hairline bg-riser font-mono text-xl text-signal"
            >
              {artist.name.trim().charAt(0).toUpperCase() || "?"}
            </span>
          )}

          <div className="min-w-0">
            <p className="eyebrow">Artist profile / daily snapshot</p>
            <h1 className="mt-2 break-words text-[clamp(1.6rem,4.5vw,2.75rem)] font-semibold leading-[1.02] tracking-[-0.03em] text-chalk [overflow-wrap:anywhere]">
              {artist.name}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] uppercase tracking-[0.12em] text-dim">
              <span className="border border-hairline px-1.5 py-1 text-ash">
                Tracked
              </span>
              <span>Snapshot {formatSnapshotDate(artist.snapshotDate)}</span>
              <span aria-hidden="true" className="text-hairline">
                /
              </span>
              <span>{formatNumber(catalogSize)} tracks on file</span>
            </p>
          </div>
        </div>

        <dl className="flex shrink-0 flex-wrap gap-x-6 gap-y-2 sm:justify-end">
          <div>
            <dt className="eyebrow">24h streams</dt>
            <dd className="mt-1 font-mono text-[18px] leading-none tabular-nums text-chalk">
              {formatNumber(artist.totalDailyStreams)}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Monthly listeners</dt>
            <dd className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-mono text-[18px] leading-none tabular-nums text-chalk">
                {formatNumber(artist.monthlyListeners)}
              </span>
              <DeltaBadge
                value={listenerChange}
                format="percent"
                size="sm"
              />
            </dd>
          </div>
        </dl>
      </header>

      {/* Metrics --------------------------------------------------------- */}
      <dl
        className="rise mt-4 grid grid-cols-2 gap-px border border-hairline bg-hairline lg:grid-cols-4"
        style={{ animationDelay: "70ms" }}
      >
        <MetricCell
          label="24h streams"
          value={formatCompact(artist.totalDailyStreams)}
          hint={`${formatNumber(artist.totalDailyStreams)} exact`}
        />
        <MetricCell
          label="Listener Δ"
          value={formatCompact(artist.listenerDelta)}
          hint={
            <DeltaBadge
              value={listenerChange}
              format="percent"
              size="sm"
            />
          }
        />
        <MetricCell
          label="Followers"
          value={formatCompact(artist.followers)}
          hint={`${formatNumber(artist.followers)} exact`}
        />
        <MetricCell
          label="Streams / listener"
          value={streamsPerListener > 0 ? streamsPerListener.toFixed(2) : "—"}
          hint="catalog conversion"
        />
      </dl>

      {/* Read line ------------------------------------------------------- */}
      <p
        className="rise mt-4 border-l-2 border-signal/70 bg-deck px-4 py-3 text-[13px] leading-relaxed text-ash"
        style={{ animationDelay: "100ms" }}
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-signal">
          Signal read
        </span>
        <br />
        {formatNumber(artist.totalDailyStreams)} streams moved across{" "}
        {formatNumber(artist.trackCount)} active tracks, against{" "}
        {formatNumber(artist.monthlyListeners)} monthly listeners —{" "}
        {artist.listenerDelta >= 0 ? "a net gain of " : "a net loss of "}
        {formatNumber(Math.abs(artist.listenerDelta))} listeners (
        {formatPercent(listenerChange)}).{" "}
        {artist.topTrack
          ? `Lead track “${artist.topTrack.name}” carries ${formatCompact(
              artist.topTrack.dailyStreams
            )} of that output.`
          : "No track moved enough to register a lead this snapshot."}
      </p>

      {/* Charts ---------------------------------------------------------- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section
          aria-labelledby="listener-trajectory"
          className="panel rise overflow-hidden"
          style={{ animationDelay: "140ms" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[9px] text-signal">01</span>
              <h2
                id="listener-trajectory"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash"
              >
                Monthly listener trajectory
              </h2>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-dim">
              {formatSnapshotDate(trajectory.listeners.periodStart)} →{" "}
              {formatSnapshotDate(trajectory.listeners.periodEnd)}
            </span>
          </div>
          <div className="p-3 sm:p-4">
            <TrajectoryChart
              trajectories={[trajectory.listeners]}
              metric="monthlyListeners"
              height={248}
            />
          </div>
        </section>

        <section
          aria-labelledby="stream-series"
          className="panel rise overflow-hidden"
          style={{ animationDelay: "180ms" }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-4 py-3">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[9px] text-signal">02</span>
              <h2
                id="stream-series"
                className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash"
              >
                Daily stream series
              </h2>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-dim">
              catalog-wide
            </span>
          </div>
          <div className="p-3 sm:p-4">
            <DailyStreamChart
              data={trajectory.streams.dataPoints}
              artistName={artist.name}
              height={248}
            />
          </div>
        </section>
      </div>

      {/* Catalog --------------------------------------------------------- */}
      <section
        aria-labelledby="catalog"
        className="rise mt-5"
        style={{ animationDelay: "220ms" }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-3">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[9px] text-signal">03</span>
            <h2
              id="catalog"
              className="font-mono text-[10px] uppercase tracking-[0.16em] text-ash"
            >
              Recent track movement
            </h2>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-dim">
              {trackEntries.length} ranked
            </span>
          </div>
          <Link
            href="/tracks"
            className="tactile inline-flex min-h-11 items-center gap-1 font-mono text-[9px] uppercase tracking-[0.14em] text-dim hover:text-signal"
          >
            Scene-wide gainers <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="mt-3">
          {trackEntries.length === 0 ? (
            <div className="panel">
              <EmptyState
                icon="tape"
                eyebrow="No track movement"
                title="This catalog has no 24-hour delta yet"
                description="Track rows appear once two consecutive snapshot days exist for this artist's catalog. The next scheduled run closes the gap."
              />
            </div>
          ) : (
            <TrackTable entries={trackEntries} isLoading={false} />
          )}
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-dim">
        <span>Source: Spotify web player · Pathfinder</span>
        <span>
          Previous snapshot {formatSnapshotDate(recentTracks[0]?.previousDate ?? artist.snapshotDate)}
        </span>
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/artists"
      className="tactile inline-flex min-h-11 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-dim hover:text-signal"
    >
      <span aria-hidden="true">←</span> Artist leaderboard
    </Link>
  );
}

function MetricCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: React.ReactNode;
}) {
  return (
    <div className="bg-deck px-4 py-3.5">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-2 flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-[20px] leading-none tabular-nums text-chalk">
          {value}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-dim">
          {hint}
        </span>
      </dd>
    </div>
  );
}
