"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  LeaderboardResponse,
  LeaderboardSortKey,
  SortDirection,
} from "@/types/contracts";
import {
  ARTIST_SORT_OPTIONS,
  ArtistTable,
} from "@/components/leaderboard/ArtistTable";
import {
  cx,
  formatNumber,
  formatSnapshotDate,
} from "@/components/leaderboard/DeltaBadge";
import {
  EmptyState,
  ErrorBoundary,
  ErrorState,
  Skeleton,
} from "@/components/ui";

const PAGE_LIMIT = 200;

export default function ArtistsPage() {
  const [sortBy, setSortBy] = useState<LeaderboardSortKey>("totalDailyStreams");
  const [direction, setDirection] = useState<SortDirection>("desc");
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const url = `/api/artists?sortBy=${sortBy}&direction=${direction}&limit=${PAGE_LIMIT}`;

    fetch(url, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Leaderboard API returned ${response.status}`);
        }
        return (await response.json()) as LeaderboardResponse;
      })
      .then((payload) => {
        setData(payload);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setLoading(false);
      });

    return () => controller.abort();
  }, [sortBy, direction, attempt]);

  const onSort = useCallback(
    (key: LeaderboardSortKey) => {
      if (key === sortBy) {
        setDirection((current) => (current === "desc" ? "asc" : "desc"));
        return;
      }
      setSortBy(key);
      setDirection("desc");
    },
    [sortBy]
  );

  const entries = data?.entries ?? [];

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((entry) =>
      entry.artist.name.toLowerCase().includes(needle)
    );
  }, [entries, filter]);

  const activeOption = ARTIST_SORT_OPTIONS.find((option) => option.key === sortBy);
  const snapshotDate = entries[0]?.artist.snapshotDate ?? null;
  const searching = filter.trim().length > 0;

  return (
    <div>
      {/* Header ---------------------------------------------------------- */}
      <div className="rise flex flex-col gap-4 border-b border-hairline pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="eyebrow">Rankings / five sort keys</p>
          <h1 className="mt-2 text-[clamp(1.75rem,4vw,2.75rem)] font-semibold leading-[0.95] tracking-[-0.035em] text-chalk">
            Artist leaderboard
          </h1>
          <p className="mt-2 max-w-[64ch] text-sm leading-relaxed text-ash">
            Catalog-attributed daily streams, audience size, and net listener
            movement for every tracked artist. Sort by any column head — the
            query re-ranks on the server, not in the browser.
          </p>
        </div>

        <dl className="flex shrink-0 flex-wrap gap-x-6 gap-y-2 sm:justify-end">
          <div>
            <dt className="eyebrow">Ranked</dt>
            <dd className="mt-1 font-mono text-[12px] text-chalk tabular-nums">
              {data ? formatNumber(data.total) : "—"}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Snapshot</dt>
            <dd className="mt-1 font-mono text-[12px] text-chalk">
              {snapshotDate ? formatSnapshotDate(snapshotDate) : "—"}
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Sort</dt>
            <dd className="mt-1 font-mono text-[12px] text-chalk">
              {activeOption?.short ?? "24H"} {direction === "desc" ? "▼" : "▲"}
            </dd>
          </div>
        </dl>
      </div>

      {/* Controls -------------------------------------------------------- */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <label className="relative flex w-full min-h-11 items-center gap-2 border border-hairline bg-void/60 px-3 focus-within:border-signal/60 lg:w-80">
          <span className="sr-only">Filter artists by name</span>
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className="shrink-0 text-dim"
          >
            <circle cx="10.5" cy="10.5" r="6" />
            <path d="M15 15l5 5" />
          </svg>
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="FILTER ARTISTS"
            spellCheck={false}
            autoComplete="off"
            className="h-11 w-full min-w-0 bg-transparent font-mono text-[11px] uppercase tracking-[0.1em] text-chalk placeholder:text-dim focus:outline-none"
          />
          {searching && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="tactile -mr-1 grid h-11 w-9 shrink-0 place-items-center text-dim hover:text-chalk"
              aria-label="Clear filter"
            >
              <span aria-hidden="true" className="font-mono text-[11px]">
                ✕
              </span>
            </button>
          )}
        </label>

        <div className="flex items-center gap-3">
          <p className="hidden font-mono text-[9px] uppercase tracking-[0.14em] text-dim md:block">
            {data
              ? `${formatNumber(filtered.length)} of ${formatNumber(entries.length)} rows`
              : "reading ledger"}
          </p>
          <div className="-mx-3 flex snap-x gap-1 overflow-x-auto px-3 pb-1 md:hidden">
            {ARTIST_SORT_OPTIONS.map((option) => {
              const active = option.key === sortBy;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => onSort(option.key)}
                  aria-pressed={active}
                  className={cx(
                    "tactile inline-flex min-h-11 shrink-0 snap-start items-center gap-1.5 border px-3 font-mono text-[10px] uppercase tracking-[0.12em]",
                    active
                      ? "border-signal/50 bg-signal/[0.08] text-signal"
                      : "border-hairline bg-deck text-dim"
                  )}
                >
                  {option.label}
                  {active && (
                    <span aria-hidden="true" className="text-[9px]">
                      {direction === "desc" ? "▼" : "▲"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ledger ---------------------------------------------------------- */}
      <div className="mt-4">
        {error ? (
          <ErrorState
            title="The leaderboard API did not answer"
            description="The table is still mounted and the sort state is preserved. Retry the read; if it fails twice, check the server route and the SQLite file."
            detail={error}
            onRetry={() => setAttempt((current) => current + 1)}
            retryLabel="Re-query leaderboard"
          />
        ) : searching && data && filtered.length === 0 ? (
          <div className="panel">
            <EmptyState
              icon="search"
              eyebrow="Filter miss"
              title={`No artist matches “${filter.trim()}”`}
              description="The filter is a literal substring match on the display name. Clear it to return to the full scene ledger."
              action={
                <button
                  type="button"
                  onClick={() => setFilter("")}
                  className="tactile inline-flex min-h-11 items-center border border-hairline bg-riser px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-chalk hover:border-signal/60 hover:text-signal"
                >
                  Clear filter
                </button>
              }
            />
          </div>
        ) : (
          <ErrorBoundary label="artist leaderboard">
            <ArtistTable
              entries={filtered}
              sortBy={sortBy}
              direction={direction}
              onSort={onSort}
              isLoading={loading}
            />
          </ErrorBoundary>
        )}
      </div>

      {loading && !data ? (
        <div className="mt-4 flex items-center gap-2" aria-hidden="true">
          <Skeleton className="h-2 w-24" />
          <Skeleton className="h-2 w-10" />
        </div>
      ) : null}
    </div>
  );
}
