"use client";

import Link from "next/link";
import type {
  ArtistTableProps,
  LeaderboardSortKey,
  SortDirection,
} from "@/types/contracts";
import { EmptyState, SkeletonTableRows } from "@/components/ui";
import {
  DeltaBadge,
  cx,
  formatCompact,
  formatNumber,
} from "./DeltaBadge";

/** The five ranking dimensions exposed by the contract. */
export const ARTIST_SORT_OPTIONS: ReadonlyArray<{
  key: LeaderboardSortKey;
  label: string;
  short: string;
}> = [
  { key: "totalDailyStreams", label: "24H Streams", short: "24H" },
  { key: "monthlyListeners", label: "Monthly Listeners", short: "ML" },
  { key: "listenerDelta", label: "Listener Delta", short: "ΔML" },
  { key: "followers", label: "Followers", short: "FOL" },
  { key: "topTrackStreams", label: "Top Track", short: "TOP" },
];

function SortGlyph({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "ml-1 inline-block font-mono text-[9px] leading-none transition-opacity",
        active ? "text-signal opacity-100" : "text-dim opacity-0 group-hover/th:opacity-60"
      )}
    >
      {active ? (direction === "desc" ? "▼" : "▲") : "▼"}
    </span>
  );
}

function Avatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const shared =
    "block h-8 w-8 shrink-0 border border-hairline bg-riser object-cover";

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt=""
        width={32}
        height={32}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className={shared}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${shared} grid place-items-center font-mono text-[11px] font-medium text-signal`}
    >
      {initial}
    </span>
  );
}

/**
 * ArtistTable — the ranking ledger.
 *
 * 52px rows, mono numerics, hairline separators. On small screens the ledger
 * becomes a tap-through card list so nothing ever overflows horizontally.
 * Sort state is owned by the caller; this component only signals intent.
 */
export function ArtistTable({
  entries,
  sortBy,
  direction,
  onSort,
  isLoading,
}: ArtistTableProps) {
  const maxStreams = entries.reduce(
    (max, entry) => Math.max(max, entry.artist.totalDailyStreams),
    0
  );
  const isEmpty = !isLoading && entries.length === 0;

  return (
    <div className="panel overflow-hidden">
      {/* Desktop ledger -------------------------------------------------- */}
      <div className="hidden overflow-x-auto md:block">
        <table
          className="w-full min-w-[840px] table-fixed border-collapse text-left"
          aria-busy={isLoading}
        >
          <caption className="sr-only">
            Desi Hip Hop artist leaderboard, ranked by daily streams, monthly
            listeners, listener delta, followers, and top track performance.
          </caption>
          <colgroup>
            <col style={{ width: "58px" }} />
            <col />
            <col style={{ width: "148px" }} />
            <col style={{ width: "132px" }} />
            <col style={{ width: "126px" }} />
            <col style={{ width: "112px" }} />
            <col style={{ width: "210px" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-hairline bg-void/40">
              <th
                scope="col"
                className="px-3 py-0 text-left font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-dim"
              >
                #
              </th>
              <th
                scope="col"
                className="px-3 py-0 text-left font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-dim"
              >
                Artist
              </th>
              {ARTIST_SORT_OPTIONS.map((option) => {
                const active = option.key === sortBy;
                const isNumeric = option.key !== "topTrackStreams";
                return (
                  <th
                    key={option.key}
                    scope="col"
                    aria-sort={
                      active
                        ? direction === "asc"
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                    className={cx(
                      "group/th px-3 py-0 font-mono text-[10px] font-normal uppercase tracking-[0.14em]",
                      isNumeric ? "text-right" : "text-left",
                      active ? "text-signal" : "text-dim"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => onSort(option.key)}
                      className={cx(
                        "tactile -mx-1 inline-flex min-h-11 w-[calc(100%+0.5rem)] items-center px-1 text-[10px] uppercase tracking-[0.14em]",
                        isNumeric ? "justify-end" : "justify-start",
                        active ? "text-signal" : "text-dim hover:text-chalk"
                      )}
                      aria-label={`Sort by ${option.label}`}
                    >
                      {option.label}
                      <SortGlyph active={active} direction={direction} />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {isLoading ? <SkeletonTableRows rows={8} columns={7} /> : null}

            {isEmpty ? (
              <tr>
                <td colSpan={7} className="border-b border-hairline">
                  <EmptyState
                    compact
                    icon="signal"
                    eyebrow="Leaderboard empty"
                    title="No artist snapshots on record"
                    description="The ledger fills the moment the first scrape run writes artist snapshots. Trigger a sync from the top bar to seed the scene."
                  />
                </td>
              </tr>
            ) : null}

            {!isLoading &&
              entries.map((entry, index) => {
                const { artist } = entry;
                const pct =
                  maxStreams > 0
                    ? Math.max(2, Math.round((artist.totalDailyStreams / maxStreams) * 100))
                    : 0;
                const podium = entry.rank <= 3;

                return (
                  <tr
                    key={artist.spotifyId}
                    className="rise group h-row border-b border-hairline/70 last:border-b-0 hover:bg-riser/40"
                    style={{ animationDelay: `${Math.min(index, 12) * 24}ms` }}
                  >
                    <td className="px-3 py-2 align-middle">
                      <span
                        className={cx(
                          "font-mono text-[12px] tabular-nums",
                          podium ? "text-signal" : "text-dim"
                        )}
                      >
                        {String(entry.rank).padStart(2, "0")}
                      </span>
                    </td>

                    <td className="min-w-0 px-3 py-2 align-middle">
                      <Link
                        href={`/artists/${artist.spotifyId}`}
                        className="group/link flex min-h-11 min-w-0 items-center gap-3"
                        aria-label={`Open ${artist.name}`}
                      >
                        <Avatar name={artist.name} imageUrl={artist.imageUrl} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium leading-tight text-chalk group-hover/link:text-signal">
                            {artist.name}
                          </span>
                          <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.08em] text-dim">
                            {artist.trackCount} {artist.trackCount === 1 ? "track" : "tracks"} tracked
                          </span>
                        </span>
                      </Link>
                    </td>

                    <td className="px-3 py-2 text-right align-middle">
                      <span
                        className="block font-mono text-[15px] leading-none text-chalk tabular-nums"
                        title={`${formatNumber(artist.totalDailyStreams)} streams in 24h`}
                      >
                        {formatCompact(artist.totalDailyStreams)}
                      </span>
                      <span
                        aria-hidden="true"
                        className="mt-1.5 ml-auto block h-[2px] max-w-full bg-hairline"
                      >
                        <span
                          className="block h-full bg-signal/80"
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right align-middle">
                      <DeltaBadge
                        value={artist.listenerDelta}
                        format="number"
                        size="sm"
                      />
                    </td>

                    <td className="px-3 py-2 text-right align-middle">
                      <span
                        className="block font-mono text-[13px] leading-none text-ash tabular-nums"
                        title={`${formatNumber(artist.monthlyListeners)} monthly listeners`}
                      >
                        {formatCompact(artist.monthlyListeners)}
                      </span>
                    </td>

                    <td className="px-3 py-2 text-right align-middle">
                      <span
                        className="block font-mono text-[13px] leading-none text-ash tabular-nums"
                        title={`${formatNumber(artist.followers)} followers`}
                      >
                        {formatCompact(artist.followers)}
                      </span>
                    </td>

                    <td className="min-w-0 px-3 py-2 align-middle">
                      {artist.topTrack ? (
                        <span className="block min-w-0">
                          <span
                            className="block truncate text-[12px] leading-tight text-ash"
                            title={artist.topTrack.name}
                          >
                            {artist.topTrack.name}
                          </span>
                          <span className="mt-0.5 block font-mono text-[10px] leading-none text-dim tabular-nums">
                            {formatCompact(artist.topTrack.dailyStreams)} / 24H
                          </span>
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-dim">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Mobile card ledger --------------------------------------------- */}
      <div className="md:hidden" aria-busy={isLoading}>
        {isLoading ? (
          <div className="divide-y divide-hairline/70">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 p-3">
                <div className="skeleton h-8 w-8 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-2/3" />
                  <div className="skeleton h-2 w-1/3" />
                </div>
                <div className="skeleton h-4 w-14" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <EmptyState
            compact
            icon="signal"
            eyebrow="Leaderboard empty"
            title="No artist snapshots on record"
            description="Run a sync to write the first artist snapshots — rankings appear here immediately after."
          />
        ) : (
          <ul>
            {entries.map((entry, index) => {
              const { artist } = entry;
              return (
                <li key={artist.spotifyId} className="border-b border-hairline/70 last:border-b-0">
                  <Link
                    href={`/artists/${artist.spotifyId}`}
                    className="rise flex min-h-[64px] items-center gap-3 px-3 py-3 active:bg-riser"
                    style={{ animationDelay: `${Math.min(index, 12) * 24}ms` }}
                  >
                    <span
                      className={cx(
                        "w-6 shrink-0 font-mono text-[12px] tabular-nums",
                        entry.rank <= 3 ? "text-signal" : "text-dim"
                      )}
                    >
                      {String(entry.rank).padStart(2, "0")}
                    </span>
                    <Avatar name={artist.name} imageUrl={artist.imageUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-chalk">
                        {artist.name}
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <DeltaBadge value={artist.listenerDelta} format="number" size="sm" />
                        <span className="font-mono text-[10px] text-dim tabular-nums">
                          {formatCompact(artist.monthlyListeners)} ML
                        </span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-[15px] leading-none text-chalk tabular-nums">
                        {formatCompact(artist.totalDailyStreams)}
                      </span>
                      <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-dim">
                        24H
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
