/**
 * DHH Pulse — Analytics Engine: Leaderboards & Scene-Wide Rankings
 *
 * Implements:
 * 1. getLeaderboard(query: LeaderboardQuery): LeaderboardResponse
 *    - Ranks artists according to 5 sort keys (totalDailyStreams, monthlyListeners, listenerDelta, followers, topTrackStreams)
 *    - Supports ascending/descending directions
 *    - Paginated with consistent 1-based ranks
 * 2. getTopGainerTracks(query: TopGainerTracksQuery): TopGainerTracksResponse
 *    - Ranks tracks across the entire scene sorted by daily stream gains descending
 *    - Paginated with consistent 1-based ranks
 */

import { aggregateArtistDailyStreams } from "./aggregator";
import { computeTrackDeltas } from "./delta";
import type {
  LeaderboardEntry,
  LeaderboardQuery,
  LeaderboardResponse,
  TopGainerTrackEntry,
  TopGainerTracksQuery,
  TopGainerTracksResponse,
} from "@/types/contracts";
import { PAGINATION_DEFAULTS } from "@/types/contracts";

/**
 * Returns sorted, paginated artist rankings based on the provided query.
 *
 * Supports sort keys:
 * - 'totalDailyStreams'
 * - 'monthlyListeners'
 * - 'listenerDelta'
 * - 'followers'
 * - 'topTrackStreams'
 */
export function getLeaderboard(query: LeaderboardQuery): LeaderboardResponse {
  const allArtists = aggregateArtistDailyStreams(query.date);

  const dirMultiplier = query.direction === "asc" ? 1 : -1;

  const sorted = [...allArtists].sort((a, b) => {
    let valA: number;
    let valB: number;

    switch (query.sortBy) {
      case "totalDailyStreams":
        valA = a.totalDailyStreams;
        valB = b.totalDailyStreams;
        break;
      case "monthlyListeners":
        valA = a.monthlyListeners;
        valB = b.monthlyListeners;
        break;
      case "listenerDelta":
        valA = a.listenerDelta;
        valB = b.listenerDelta;
        break;
      case "followers":
        valA = a.followers;
        valB = b.followers;
        break;
      case "topTrackStreams":
        valA = a.topTrack?.dailyStreams ?? 0;
        valB = b.topTrack?.dailyStreams ?? 0;
        break;
      default:
        valA = a.totalDailyStreams;
        valB = b.totalDailyStreams;
    }

    if (valA !== valB) {
      return (valA - valB) * dirMultiplier;
    }
    // Tiebreaker: deterministic alphabetical sort by artist name
    return a.name.localeCompare(b.name);
  });

  const offset = Math.max(0, query.offset || 0);
  const limit =
    query.limit > 0 ? query.limit : PAGINATION_DEFAULTS.LEADERBOARD_PAGE_SIZE;
  const paged = sorted.slice(offset, offset + limit);

  const entries: LeaderboardEntry[] = paged.map((artist, idx) => ({
    rank: offset + idx + 1,
    artist,
  }));

  return {
    entries,
    total: sorted.length,
    query,
    generatedAt: Date.now(),
  };
}

/**
 * Returns scene-wide top gaining tracks sorted by dailyStreams descending, paginated with rank numbers.
 */
export function getTopGainerTracks(
  query: TopGainerTracksQuery
): TopGainerTracksResponse {
  const deltas = computeTrackDeltas(query.date);

  // Scene-wide top gaining tracks sorted by dailyStreams descending
  const sorted = [...deltas].sort((a, b) => {
    if (b.dailyStreams !== a.dailyStreams) {
      return b.dailyStreams - a.dailyStreams;
    }
    // Secondary sort: currentPlaycount descending
    return b.currentPlaycount - a.currentPlaycount;
  });

  const offset = Math.max(0, query.offset || 0);
  const limit =
    query.limit > 0 ? query.limit : PAGINATION_DEFAULTS.TOP_TRACKS_PAGE_SIZE;
  const paged = sorted.slice(offset, offset + limit);

  const entries: TopGainerTrackEntry[] = paged.map((track, idx) => ({
    rank: offset + idx + 1,
    track,
  }));

  return {
    entries,
    total: sorted.length,
    query,
    generatedAt: Date.now(),
  };
}
