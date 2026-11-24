/**
 * DHH Pulse — Unit Tests: leaderboard.ts
 * Tests getLeaderboard and getTopGainerTracks with mocked aggregator and delta.
 *
 * Both functions are pure data-transformation pipelines over their dependencies —
 * we mock aggregateArtistDailyStreams and computeTrackDeltas so the tests
 * focus entirely on sorting, pagination, ranking, and response shape.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Mock DB (required because aggregator transitively calls getDb) ───────────
const mockGet = vi.fn();
const mockAll = vi.fn();
vi.mock("@/lib/db/client", () => ({
  getDb: () => ({ prepare: vi.fn(() => ({ get: mockGet, all: mockAll })) }),
}));

// ── Mock aggregator ───────────────────────────────────────────────────────────
const mockAggregateArtistDailyStreams = vi.fn();
vi.mock("./aggregator", () => ({
  aggregateArtistDailyStreams: (...args: unknown[]) => mockAggregateArtistDailyStreams(...args),
}));

// ── Mock delta (computeTrackDeltas used by getTopGainerTracks) ───────────────
const mockComputeTrackDeltas = vi.fn();
vi.mock("./delta", () => ({
  computeTrackDeltas: (...args: unknown[]) => mockComputeTrackDeltas(...args),
  computeArtistDeltas: vi.fn(() => []),
}));

// ── Import AFTER mocks ───────────────────────────────────────────────────────
import { getLeaderboard, getTopGainerTracks } from "./leaderboard";
import type {
  LeaderboardQuery,
  SnapshotDate,
  SpotifyArtistId,
  SpotifyTrackId,
  TopGainerTracksQuery,
} from "@/types/contracts";

// Helpers
const date = (s: string) => s as SnapshotDate;
const artistId = (s: string) => s as SpotifyArtistId;
const trackId = (s: string) => s as SpotifyTrackId;
const TARGET_DATE = date("2024-11-24");

function makeArtistAggregate(overrides: Partial<{
  spotifyId: string;
  name: string;
  totalDailyStreams: number;
  monthlyListeners: number;
  listenerDelta: number;
  followers: number;
  topTrackDailyStreams: number;
  imageUrl: string | null;
  trackCount: number;
}> = {}) {
  return {
    spotifyId: artistId(overrides.spotifyId ?? "a1"),
    name: overrides.name ?? "Artist",
    imageUrl: overrides.imageUrl ?? null,
    totalDailyStreams: overrides.totalDailyStreams ?? 100_000,
    trackCount: overrides.trackCount ?? 10,
    topTrack: overrides.topTrackDailyStreams !== undefined
      ? { trackId: trackId("t1"), name: "Top Track", dailyStreams: overrides.topTrackDailyStreams }
      : null,
    monthlyListeners: overrides.monthlyListeners ?? 1_000_000,
    listenerDelta: overrides.listenerDelta ?? 10_000,
    followers: overrides.followers ?? 500_000,
    snapshotDate: TARGET_DATE,
  };
}

function makeTrackDelta(overrides: Partial<{
  trackId: string;
  trackName: string;
  artistId: string;
  artistName: string;
  albumName: string;
  currentPlaycount: number;
  previousPlaycount: number;
  dailyStreams: number;
}> = {}) {
  return {
    trackId: trackId(overrides.trackId ?? "t1"),
    trackName: overrides.trackName ?? "Track",
    artistId: artistId(overrides.artistId ?? "a1"),
    artistName: overrides.artistName ?? "Artist",
    albumName: overrides.albumName ?? "Album",
    currentPlaycount: overrides.currentPlaycount ?? 10_000_000,
    previousPlaycount: overrides.previousPlaycount ?? 9_000_000,
    dailyStreams: overrides.dailyStreams ?? 1_000_000,
    snapshotDate: TARGET_DATE,
    previousDate: date("2024-11-23"),
  };
}

function makeLeaderboardQuery(overrides: Partial<LeaderboardQuery> = {}): LeaderboardQuery {
  return {
    sortBy: "totalDailyStreams",
    direction: "desc",
    limit: 50,
    offset: 0,
    date: TARGET_DATE,
    ...overrides,
  };
}

function makeTopGainerQuery(overrides: Partial<TopGainerTracksQuery> = {}): TopGainerTracksQuery {
  return {
    limit: 50,
    offset: 0,
    date: TARGET_DATE,
    ...overrides,
  };
}

// ── getLeaderboard ────────────────────────────────────────────────────────────
describe("getLeaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correct response shape with entries, total, query, generatedAt", () => {
    mockAggregateArtistDailyStreams.mockReturnValueOnce([
      makeArtistAggregate({ spotifyId: "a1", totalDailyStreams: 500_000 }),
    ]);

    const response = getLeaderboard(makeLeaderboardQuery());

    expect(response).toMatchObject({
      entries: expect.any(Array),
      total: 1,
      query: expect.objectContaining({ sortBy: "totalDailyStreams" }),
      generatedAt: expect.any(Number),
    });
    expect(response.entries[0]).toMatchObject({
      rank: 1,
      artist: expect.objectContaining({ spotifyId: "a1" }),
    });
  });

  it("CRITICAL: sorts by totalDailyStreams descending by default", () => {
    mockAggregateArtistDailyStreams.mockReturnValueOnce([
      makeArtistAggregate({ spotifyId: "a3", name: "C", totalDailyStreams: 100_000 }),
      makeArtistAggregate({ spotifyId: "a1", name: "A", totalDailyStreams: 900_000 }),
      makeArtistAggregate({ spotifyId: "a2", name: "B", totalDailyStreams: 500_000 }),
    ]);

    const { entries } = getLeaderboard(makeLeaderboardQuery({ sortBy: "totalDailyStreams", direction: "desc" }));

    expect(entries[0].artist.spotifyId).toBe("a1"); // 900k first
    expect(entries[1].artist.spotifyId).toBe("a2"); // 500k second
    expect(entries[2].artist.spotifyId).toBe("a3"); // 100k third
  });

  it("sorts by totalDailyStreams ascending when direction='asc'", () => {
    mockAggregateArtistDailyStreams.mockReturnValueOnce([
      makeArtistAggregate({ spotifyId: "a1", totalDailyStreams: 900_000 }),
      makeArtistAggregate({ spotifyId: "a2", totalDailyStreams: 100_000 }),
    ]);

    const { entries } = getLeaderboard(makeLeaderboardQuery({ direction: "asc" }));

    expect(entries[0].artist.spotifyId).toBe("a2"); // lowest first
    expect(entries[1].artist.spotifyId).toBe("a1");
  });

  it("CRITICAL: applies pagination offset — rank starts at offset+1", () => {
    mockAggregateArtistDailyStreams.mockReturnValueOnce([
      makeArtistAggregate({ spotifyId: "a1", totalDailyStreams: 900_000 }),
      makeArtistAggregate({ spotifyId: "a2", totalDailyStreams: 500_000 }),
      makeArtistAggregate({ spotifyId: "a3", totalDailyStreams: 100_000 }),
    ]);

    const { entries, total } = getLeaderboard(makeLeaderboardQuery({ offset: 1, limit: 2 }));

    expect(total).toBe(3); // total is always the full set
    expect(entries).toHaveLength(2);
    expect(entries[0].rank).toBe(2); // offset 1 → rank starts at 2
    expect(entries[0].artist.spotifyId).toBe("a2");
    expect(entries[1].rank).toBe(3);
  });

  it("respects the limit and returns no more than limit entries", () => {
    mockAggregateArtistDailyStreams.mockReturnValueOnce([
      makeArtistAggregate({ spotifyId: "a1", totalDailyStreams: 900_000 }),
      makeArtistAggregate({ spotifyId: "a2", totalDailyStreams: 500_000 }),
      makeArtistAggregate({ spotifyId: "a3", totalDailyStreams: 100_000 }),
    ]);

    const { entries } = getLeaderboard(makeLeaderboardQuery({ limit: 2, offset: 0 }));
    expect(entries).toHaveLength(2);
  });

  it("rank numbers are consecutive starting from offset+1", () => {
    mockAggregateArtistDailyStreams.mockReturnValueOnce([
      makeArtistAggregate({ spotifyId: "a1", totalDailyStreams: 900_000 }),
      makeArtistAggregate({ spotifyId: "a2", totalDailyStreams: 500_000 }),
      makeArtistAggregate({ spotifyId: "a3", totalDailyStreams: 100_000 }),
    ]);

    const { entries } = getLeaderboard(makeLeaderboardQuery({ offset: 0, limit: 50 }));
    entries.forEach((e, i) => {
      expect(e.rank).toBe(i + 1);
    });
  });

  it("sorts by monthlyListeners when sortBy='monthlyListeners'", () => {
    mockAggregateArtistDailyStreams.mockReturnValueOnce([
      makeArtistAggregate({ spotifyId: "a1", monthlyListeners: 2_000_000 }),
      makeArtistAggregate({ spotifyId: "a2", monthlyListeners: 8_000_000 }),
    ]);

    const { entries } = getLeaderboard(makeLeaderboardQuery({ sortBy: "monthlyListeners", direction: "desc" }));

    expect(entries[0].artist.spotifyId).toBe("a2"); // 8M first
    expect(entries[1].artist.spotifyId).toBe("a1");
  });

  it("returns empty entries and total=0 when no artists exist", () => {
    mockAggregateArtistDailyStreams.mockReturnValueOnce([]);
    const response = getLeaderboard(makeLeaderboardQuery());

    expect(response.entries).toEqual([]);
    expect(response.total).toBe(0);
  });

  it("generatedAt is a valid Unix millisecond timestamp", () => {
    const before = Date.now();
    mockAggregateArtistDailyStreams.mockReturnValueOnce([]);
    const { generatedAt } = getLeaderboard(makeLeaderboardQuery());
    const after = Date.now();

    expect(generatedAt).toBeGreaterThanOrEqual(before);
    expect(generatedAt).toBeLessThanOrEqual(after);
  });

  it("echoes the query object back in the response", () => {
    mockAggregateArtistDailyStreams.mockReturnValueOnce([]);
    const query = makeLeaderboardQuery({ sortBy: "followers", direction: "asc", limit: 10, offset: 5 });
    const response = getLeaderboard(query);

    expect(response.query).toEqual(query);
  });
});

// ── getTopGainerTracks ────────────────────────────────────────────────────────
describe("getTopGainerTracks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns correct response shape with entries, total, query, generatedAt", () => {
    mockComputeTrackDeltas.mockReturnValueOnce([
      makeTrackDelta({ trackId: "t1", dailyStreams: 500_000 }),
    ]);

    const response = getTopGainerTracks(makeTopGainerQuery());

    expect(response).toMatchObject({
      entries: expect.any(Array),
      total: 1,
      query: expect.objectContaining({ limit: 50 }),
      generatedAt: expect.any(Number),
    });
    expect(response.entries[0]).toMatchObject({
      rank: 1,
      track: expect.objectContaining({ trackId: "t1" }),
    });
  });

  it("CRITICAL: sorts tracks by dailyStreams descending", () => {
    mockComputeTrackDeltas.mockReturnValueOnce([
      makeTrackDelta({ trackId: "t3", dailyStreams: 100_000 }),
      makeTrackDelta({ trackId: "t1", dailyStreams: 900_000 }),
      makeTrackDelta({ trackId: "t2", dailyStreams: 500_000 }),
    ]);

    const { entries } = getTopGainerTracks(makeTopGainerQuery());

    expect(entries[0].track.trackId).toBe("t1"); // 900k first
    expect(entries[1].track.trackId).toBe("t2"); // 500k second
    expect(entries[2].track.trackId).toBe("t3"); // 100k third
  });

  it("rank numbers are consecutive starting at 1", () => {
    mockComputeTrackDeltas.mockReturnValueOnce([
      makeTrackDelta({ trackId: "t1", dailyStreams: 300_000 }),
      makeTrackDelta({ trackId: "t2", dailyStreams: 200_000 }),
      makeTrackDelta({ trackId: "t3", dailyStreams: 100_000 }),
    ]);

    const { entries } = getTopGainerTracks(makeTopGainerQuery());
    entries.forEach((e, i) => {
      expect(e.rank).toBe(i + 1);
    });
  });

  it("CRITICAL: pagination — offset shifts rank numbers and returns correct slice", () => {
    mockComputeTrackDeltas.mockReturnValueOnce([
      makeTrackDelta({ trackId: "t1", dailyStreams: 900_000 }),
      makeTrackDelta({ trackId: "t2", dailyStreams: 600_000 }),
      makeTrackDelta({ trackId: "t3", dailyStreams: 300_000 }),
    ]);

    const { entries, total } = getTopGainerTracks(makeTopGainerQuery({ offset: 1, limit: 2 }));

    expect(total).toBe(3);
    expect(entries).toHaveLength(2);
    expect(entries[0].rank).toBe(2);
    expect(entries[0].track.trackId).toBe("t2");
    expect(entries[1].rank).toBe(3);
  });

  it("respects the limit", () => {
    mockComputeTrackDeltas.mockReturnValueOnce([
      makeTrackDelta({ trackId: "t1", dailyStreams: 900_000 }),
      makeTrackDelta({ trackId: "t2", dailyStreams: 600_000 }),
      makeTrackDelta({ trackId: "t3", dailyStreams: 300_000 }),
    ]);

    const { entries } = getTopGainerTracks(makeTopGainerQuery({ limit: 2 }));
    expect(entries).toHaveLength(2);
  });

  it("CRITICAL: clamped-negative tracks (dailyStreams=0) sort last", () => {
    mockComputeTrackDeltas.mockReturnValueOnce([
      makeTrackDelta({ trackId: "t1", dailyStreams: 0 }),    // clamped negative
      makeTrackDelta({ trackId: "t2", dailyStreams: 500_000 }),
      makeTrackDelta({ trackId: "t3", dailyStreams: 0 }),    // also clamped
    ]);

    const { entries } = getTopGainerTracks(makeTopGainerQuery());

    expect(entries[0].track.trackId).toBe("t2"); // positive first
    // the two 0-delta tracks are last (order between them determined by currentPlaycount tiebreaker)
    expect(entries[1].track.dailyStreams).toBe(0);
    expect(entries[2].track.dailyStreams).toBe(0);
  });

  it("tiebreaker: when dailyStreams equal, sorts by currentPlaycount descending", () => {
    mockComputeTrackDeltas.mockReturnValueOnce([
      makeTrackDelta({ trackId: "t1", dailyStreams: 200_000, currentPlaycount: 1_000_000 }),
      makeTrackDelta({ trackId: "t2", dailyStreams: 200_000, currentPlaycount: 5_000_000 }),
    ]);

    const { entries } = getTopGainerTracks(makeTopGainerQuery());

    expect(entries[0].track.trackId).toBe("t2"); // higher playcount wins tiebreaker
    expect(entries[1].track.trackId).toBe("t1");
  });

  it("returns empty entries and total=0 when no tracks exist", () => {
    mockComputeTrackDeltas.mockReturnValueOnce([]);
    const response = getTopGainerTracks(makeTopGainerQuery());

    expect(response.entries).toEqual([]);
    expect(response.total).toBe(0);
  });

  it("CRITICAL: missing previous snapshot tracks have dailyStreams=0 and appear last", () => {
    // Track with no prior snapshot → computeTrackDeltas already clamped to 0
    mockComputeTrackDeltas.mockReturnValueOnce([
      makeTrackDelta({ trackId: "new-track", dailyStreams: 0, currentPlaycount: 50_000_000 }),
      makeTrackDelta({ trackId: "old-track", dailyStreams: 300_000, currentPlaycount: 10_000_000 }),
    ]);

    const { entries } = getTopGainerTracks(makeTopGainerQuery());

    expect(entries[0].track.trackId).toBe("old-track"); // has actual daily streams
    expect(entries[1].track.trackId).toBe("new-track"); // no prior snapshot → 0 → last
  });

  it("echoes the query object back in the response", () => {
    mockComputeTrackDeltas.mockReturnValueOnce([]);
    const query = makeTopGainerQuery({ limit: 10, offset: 5 });
    const response = getTopGainerTracks(query);

    expect(response.query).toEqual(query);
  });

  it("generatedAt is a valid Unix millisecond timestamp", () => {
    const before = Date.now();
    mockComputeTrackDeltas.mockReturnValueOnce([]);
    const { generatedAt } = getTopGainerTracks(makeTopGainerQuery());
    const after = Date.now();

    expect(generatedAt).toBeGreaterThanOrEqual(before);
    expect(generatedAt).toBeLessThanOrEqual(after);
  });
});
