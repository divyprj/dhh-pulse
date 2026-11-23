"use client";

import Link from "next/link";
import type { TrackTableProps } from "@/types/contracts";
import { EmptyState, SkeletonTableRows } from "@/components/ui";
import { cx, formatCompact, formatNumber } from "./DeltaBadge";

/**
 * TrackTable — scene-wide gainers.
 *
 * The 24-hour gain owns the visual weight; lifetime playcount sits beside it for
 * scale. Titles are truncated on one line with the full string in `title`
 * so a 100-character unbroken name can never blow the grid apart.
 */
export function TrackTable({ entries, isLoading }: TrackTableProps) {
  const maxGain = entries.reduce(
    (max, entry) => Math.max(max, entry.track.dailyStreams),
    0
  );
  const isEmpty = !isLoading && entries.length === 0;

  return (
    <div className="panel overflow-hidden">
      {/* Desktop ledger -------------------------------------------------- */}
      <div className="hidden overflow-x-auto md:block">
        <table
          className="w-full min-w-[760px] table-fixed border-collapse text-left"
          aria-busy={isLoading}
        >
          <caption className="sr-only">
            Top gaining Desi Hip Hop tracks for the latest snapshot, ranked by
            24-hour stream gain.
          </caption>
          <colgroup>
            <col style={{ width: "58px" }} />
            <col />
            <col style={{ width: "188px" }} />
            <col style={{ width: "136px" }} />
            <col style={{ width: "136px" }} />
          </colgroup>
          <thead>
            <tr className="border-b border-hairline bg-void/40">
              <th
                scope="col"
                className="px-3 py-3 text-left font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-dim"
              >
                #
              </th>
              <th
                scope="col"
                className="px-3 py-3 text-left font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-dim"
              >
                Track
              </th>
              <th
                scope="col"
                className="px-3 py-3 text-left font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-dim"
              >
                Artist
              </th>
              <th
                scope="col"
                className="px-3 py-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-signal"
              >
                24H Gain
              </th>
              <th
                scope="col"
                className="px-3 py-3 text-right font-mono text-[10px] font-normal uppercase tracking-[0.14em] text-dim"
              >
                Lifetime
              </th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? <SkeletonTableRows rows={8} columns={5} /> : null}

            {isEmpty ? (
              <tr>
                <td colSpan={5} className="border-b border-hairline">
                  <EmptyState
                    compact
                    icon="tape"
                    eyebrow="No gainers"
                    title="No track movement recorded"
                    description="Track gains require two consecutive snapshot days. Once today's playcounts land on top of yesterday's, the gainers table fills itself."
                  />
                </td>
              </tr>
            ) : null}

            {!isLoading &&
              entries.map((entry, index) => {
                const { track } = entry;
                const pct =
                  maxGain > 0
                    ? Math.max(2, Math.round((track.dailyStreams / maxGain) * 100))
                    : 0;

                return (
                  <tr
                    key={`${track.trackId}-${entry.rank}`}
                    className="rise h-row border-b border-hairline/70 last:border-b-0 hover:bg-riser/40"
                    style={{ animationDelay: `${Math.min(index, 12) * 24}ms` }}
                  >
                    <td className="px-3 py-2 align-middle">
                      <span
                        className={cx(
                          "font-mono text-[12px] tabular-nums",
                          entry.rank <= 3 ? "text-signal" : "text-dim"
                        )}
                      >
                        {String(entry.rank).padStart(2, "0")}
                      </span>
                    </td>

                    <td className="min-w-0 px-3 py-3 align-middle">
                      <span
                        className="block truncate text-[13px] font-medium leading-tight text-chalk"
                        title={track.trackName}
                      >
                        {track.trackName}
                      </span>
                      <span
                        className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.08em] text-dim"
                        title={track.albumName}
                      >
                        {track.albumName}
                      </span>
                    </td>

                    <td className="min-w-0 px-3 py-3 align-middle">
                      <Link
                        href={`/artists/${track.artistId}`}
                        className="tactile flex min-h-11 min-w-0 items-center text-[12px] text-ash hover:text-signal"
                        title={track.artistName}
                      >
                        <span className="truncate">{track.artistName}</span>
                      </Link>
                    </td>

                    <td className="px-3 py-3 text-right align-middle">
                      <span
                        className="block font-mono text-[15px] leading-none text-chalk tabular-nums"
                        title={`${formatNumber(track.dailyStreams)} streams in 24h`}
                      >
                        {formatCompact(track.dailyStreams)}
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

                    <td className="px-3 py-3 text-right align-middle">
                      <span
                        className="block font-mono text-[13px] leading-none text-ash tabular-nums"
                        title={`${formatNumber(track.currentPlaycount)} lifetime streams`}
                      >
                        {formatCompact(track.currentPlaycount)}
                      </span>
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
              <div key={index} className="space-y-2 p-3">
                <div className="skeleton h-3 w-4/5" />
                <div className="skeleton h-2.5 w-1/3" />
                <div className="skeleton h-4 w-20" />
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <EmptyState
            compact
            icon="tape"
            eyebrow="No gainers"
            title="No track movement recorded"
            description="Two consecutive snapshot days are required before daily gains can be computed."
          />
        ) : (
          <ul>
            {entries.map((entry, index) => {
              const { track } = entry;
              return (
                <li
                  key={`${track.trackId}-${entry.rank}`}
                  className="rise border-b border-hairline/70 px-3 py-3 last:border-b-0"
                  style={{ animationDelay: `${Math.min(index, 12) * 24}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cx(
                        "mt-0.5 w-6 shrink-0 font-mono text-[12px] tabular-nums",
                        entry.rank <= 3 ? "text-signal" : "text-dim"
                      )}
                    >
                      {String(entry.rank).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium leading-snug text-chalk [overflow-wrap:anywhere]">
                        {track.trackName}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-dim">
                        <Link
                          href={`/artists/${track.artistId}`}
                          className="min-h-11 py-0.5 text-ash hover:text-signal"
                        >
                          {track.artistName}
                        </Link>
                        <span aria-hidden="true">/</span>
                        <span className="min-w-0 truncate normal-case tracking-normal">
                          {track.albumName}
                        </span>
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-mono text-[15px] leading-none text-chalk tabular-nums">
                        {formatCompact(track.dailyStreams)}
                      </p>
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-dim">
                        24H
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
