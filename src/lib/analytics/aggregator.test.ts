/**
 * DHH Pulse — Unit Tests: aggregator.ts
 * Tests aggregateArtistDailyStreams with mocked DB and mocked delta functions.
 *
 * Strategy: mock @/lib/db/client so aggregator's direct DB calls return controlled
 * data, and also mock ./delta so computeTrackDeltas and computeArtistDeltas return
 * controlled fixtures without recursively hitting the DB.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Mock DB ─────────────────────────────────────────────────────────────────
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockPrepare = vi.fn(() => ({ get: mockGet, all: mockAll }));
const mockDb = { prepare: mockPrepare };

vi.mock("@/lib/db/client", () => ({
  getDb: () => mockDb,
}));

// ── Mock delta functions ─────────────────────────────────────────────────────
const mockComputeTrackDeltas = vi.fn();
const mockComputeArtistDeltas = vi.fn();

vi.mock("./delta", () => ({
  computeTrackDeltas: (...args: unknown[]) => mockComputeTrackDeltas(...args),
  computeArtistDeltas: (...args: unknown[]) => mockComputeArtistDeltas(...args),
}));

// ── Import AFTER mocks ───────────────────────────────────────────────────────
import { aggregateArtistDailyStreams } from "./aggregator";
import type { SnapshotDate, SpotifyArtistId, SpotifyTrackId } from "@/types/contracts";

// Helpers
const date = (s: string) => s as SnapshotDate;
const artistId = (s: string) => s as SpotifyArtistId;
const trackId = (s: string) => s as SpotifyTrackId;

const TARGET_DATE = date("2024-11-24");

// ── Shared fixture builders ──────────────────────────────────────────────────
function makeTrackDelta(overrides: Partial<{
  trackId: string;
  trackName: string;
  artistId: string;
  artistName: string;
  albumName: string;
  currentPlaycount: number;
  previousPlaycount: number;
  dailyStreams: number;
  snapshotDate: string;
  previousDate: string;
}> = {}) {
  return {
    trackId: trackId(overrides.trackId ?? "t1"),
    trackName: overrides.trackName ?? "Track",
    artistId: artistId(overrides.artistId ?? "a1"),
    artistName: overrides.artistName ?? "Artist",
    albumName: overrides.albumName ?? "Album",
    currentPlaycount: overrides.currentPlaycount ?? 1_000_000,
    previousPlaycount: overrides.previousPlaycount ?? 900_000,
    dailyStreams: overrides.dailyStreams ?? 100_000,
    snapshotDate: date(overrides.snapshotDate ?? "2024-11-24"),
    previousDate: date(overrides.previousDate ?? "2024-11-23"),
  };
}

function makeArtistDelta(overrides: Partial<{
  spotifyId: string;
  name: string;
  listenerDelta: number;
  followerDelta: number;
  currentMonthlyListeners: number;
  previousMonthlyListeners: number;
  currentFollowers: number;
  previousFollowers: number;
}> = {}) {
  return {
    spotifyId: artistId(overrides.spotifyId ?? "a1"),
    name: overrides.name ?? "Artist",
    currentMonthlyListeners: overrides.currentMonthlyListeners ?? 5_000_000,
    previousMonthlyListeners: overrides.previousMonthlyListeners ?? 4_900_000,
    listenerDelta: overrides.listenerDelta ?? 100_000,
    currentFollowers: overrides.currentFollowers ?? 1_000_000,
    previousFollowers: overrides.previousFollowers ?? 990_000,
    followerDelta: overrides.followerDelta ?? 10_000,
    snapshotDate: date("2024-11-24"),
    previousDate: date("2024-11-23"),
  };
}

function makeArtistSnapshotRow(overrides: Partial<{
  spotify_id: string;
  name: string;
  monthly_listeners: number;
  followers: number;
  image_url: string | null;
}> = {}) {
  return {
    spotify_id: overrides.spotify_id ?? "a1",
    name: overrides.name ?? "Artist",
    monthly_listeners: overrides.monthly_listeners ?? 5_000_000,
    followers: overrides.followers ?? 1_000_000,
    image_url: overrides.image_url ?? null,
    snapshot_date: "2024-11-24",
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────
describe("aggregateArtistDailyStreams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] when DB has no snapshots (auto-date path)", () => {
    // artist max date -> null
    mockGet.mockReturnValueOnce({ max_date: null });
    // track max date -> null
    mockGet.mockReturnValueOnce({ max_date: null });

    const result = aggregateArtistDailyStreams();
    expect(result).toEqual([]);
  });

  it("aggregates a single artist with one track correctly", () => {
    // DB artist snapshots query
    mockAll.mockReturnValueOnce([makeArtistSnapshotRow({ spotify_id: "a1", name: "KR$NA", monthly_listeners: 5_000_000, followers: 1_200_000, image_url: null })]);

    mockComputeTrackDeltas.mockReturnValueOnce([
      makeTrackDelta({ trackId: "t1", artistId: "a1", dailyStreams: 300_000 }),
    ]);
    mockComputeArtistDeltas.mockReturnValueOnce([
      makeArtistDelta({ spotifyId: "a1", name: "KR$NA", listenerDelta: 50_000 }),
    ]);

    const result = aggregateArtistDailyStreams(TARGET_DATE);

    expect(result).toHaveLength(1);
    const agg = result[0];
    expect(agg.spotifyId).toBe("a1");
    expect(agg.name).toBe("KR$NA");
    expect(agg.totalDailyStreams).toBe(300_000);
    expect(agg.trackCount).toBe(1);
    expect(agg.listenerDelta).toBe(50_000);
    expect(agg.monthlyListeners).toBe(5_000_000);
    expect(agg.followers).toBe(1_200_000);
    expect(agg.snapshotDate).toBe(TARGET_DATE);
  });

  it("CRITICAL: correctly sums multiple track deltas for the same artist (clamped negatives excluded)", () => {
    mockAll.mockReturnValueOnce([makeArtistSnapshotRow({ spotify_id: "a1", name: "KR$NA" })]);
    mockComputeTrackDeltas.mockReturnValueOnce([
      makeTrackDelta({ trackId: "t1", artistId: "a1", dailyStreams: 500_000 }),
      makeTrackDelta({ trackId: "t2", artistId: "a1", dailyStreams: 0 }),    // clamped negative
      makeTrackDelta({ trackId: "t3", artistId: "a1", dailyStreams: 200_000 }),
    ]);
    mockComputeArtistDeltas.mockReturnValueOnce([
      makeArtistDelta({ spotifyId: "a1", listenerDelta: 10_000 }),
    ]);

    const [agg] = aggregateArtistDailyStreams(TARGET_DATE);

    // 500k + 0 + 200k = 700k (the 0-clamped track contributes 0, not negative)
    expect(agg.totalDailyStreams).toBe(700_000);
    expect(agg.trackCount).toBe(3);
  });

  it("identifies topTrack as the track with highest dailyStreams", () => {
    mockAll.mockReturnValueOnce([makeArtistSnapshotRow({ spotify_id: "a2", name: "Seedhe Maut" })]);
    mockComputeTrackDeltas.mockReturnValueOnce([
      makeTrackDelta({ trackId: "t1", trackName: "Nanchaku", artistId: "a2", dailyStreams: 100_000 }),
      makeTrackDelta({ trackId: "t2", trackName: "Bhool Ja", artistId: "a2", dailyStreams: 450_000 }),
      makeTrackDelta({ trackId: "t3", trackName: "Mera Baap", artistId: "a2", dailyStreams: 200_000 }),
    ]);
    mockComputeArtistDeltas.mockReturnValueOnce([
      makeArtistDelta({ spotifyId: "a2" }),
    ]);

    const [agg] = aggregateArtistDailyStreams(TARGET_DATE);

    expect(agg.topTrack).not.toBeNull();
    expect(agg.topTrack?.name).toBe("Bhool Ja");
    expect(agg.topTrack?.dailyStreams).toBe(450_000);
  });

  it("sets topTrack=null when artist has no tracks", () => {
    mockAll.mockReturnValueOnce([makeArtistSnapshotRow({ spotify_id: "a3", name: "New Artist" })]);
    // No tracks at all for this artist
    mockComputeTrackDeltas.mockReturnValueOnce([]);
    mockComputeArtistDeltas.mockReturnValueOnce([
      makeArtistDelta({ spotifyId: "a3" }),
    ]);

    const [agg] = aggregateArtistDailyStreams(TARGET_DATE);

    expect(agg.topTrack).toBeNull();
    expect(agg.totalDailyStreams).toBe(0);
    expect(agg.trackCount).toBe(0);
  });

  it("produces separate aggregate entries for multiple artists without cross-contamination", () => {
    mockAll.mockReturnValueOnce([
      makeArtistSnapshotRow({ spotify_id: "a1", name: "KR$NA", monthly_listeners: 5_000_000 }),
      makeArtistSnapshotRow({ spotify_id: "a2", name: "MC Stan", monthly_listeners: 8_000_000 }),
    ]);
    mockComputeTrackDeltas.mockReturnValueOnce([
      makeTrackDelta({ trackId: "t1", artistId: "a1", dailyStreams: 200_000 }),
      makeTrackDelta({ trackId: "t2", artistId: "a2", dailyStreams: 600_000 }),
    ]);
    mockComputeArtistDeltas.mockReturnValueOnce([
      makeArtistDelta({ spotifyId: "a1", listenerDelta: 10_000 }),
      makeArtistDelta({ spotifyId: "a2", listenerDelta: 300_000 }),
    ]);

    const result = aggregateArtistDailyStreams(TARGET_DATE);
    expect(result).toHaveLength(2);

    const krna = result.find((a) => a.spotifyId === "a1");
    const mcStan = result.find((a) => a.spotifyId === "a2");

    expect(krna?.totalDailyStreams).toBe(200_000);
    expect(krna?.listenerDelta).toBe(10_000);
    expect(mcStan?.totalDailyStreams).toBe(600_000);
    expect(mcStan?.listenerDelta).toBe(300_000);
  });

  it("propagates imageUrl=null when snapshot image_url is null", () => {
    mockAll.mockReturnValueOnce([makeArtistSnapshotRow({ spotify_id: "a1", image_url: null })]);
    mockComputeTrackDeltas.mockReturnValueOnce([]);
    mockComputeArtistDeltas.mockReturnValueOnce([makeArtistDelta({ spotifyId: "a1" })]);

    const [agg] = aggregateArtistDailyStreams(TARGET_DATE);
    expect(agg.imageUrl).toBeNull();
  });

  it("propagates imageUrl when snapshot has a URL", () => {
    mockAll.mockReturnValueOnce([makeArtistSnapshotRow({ spotify_id: "a1", image_url: "https://i.scdn.co/image/abc" })]);
    mockComputeTrackDeltas.mockReturnValueOnce([]);
    mockComputeArtistDeltas.mockReturnValueOnce([makeArtistDelta({ spotifyId: "a1" })]);

    const [agg] = aggregateArtistDailyStreams(TARGET_DATE);
    expect(agg.imageUrl).toBe("https://i.scdn.co/image/abc");
  });

  it("sets snapshotDate to the target date on all aggregates", () => {
    mockAll.mockReturnValueOnce([makeArtistSnapshotRow({ spotify_id: "a1" })]);
    mockComputeTrackDeltas.mockReturnValueOnce([]);
    mockComputeArtistDeltas.mockReturnValueOnce([makeArtistDelta({ spotifyId: "a1" })]);

    const [agg] = aggregateArtistDailyStreams(TARGET_DATE);
    expect(agg.snapshotDate).toBe(TARGET_DATE);
  });
});
