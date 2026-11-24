/**
 * DHH Pulse — Unit Tests: delta.ts
 * Tests computeTrackDeltas and computeArtistDeltas with an in-memory mock DB.
 * All SQLite calls are intercepted via vi.mock — no real DB is used.
 */

import { vi, describe, it, expect, beforeEach } from "vitest";

// ── Mock DB setup (must be declared before module imports) ──────────────────
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockPrepare = vi.fn(() => ({ get: mockGet, all: mockAll }));
const mockDb = { prepare: mockPrepare };

vi.mock("@/lib/db/client", () => ({
  getDb: () => mockDb,
}));

// ── Import AFTER mock ───────────────────────────────────────────────────────
import { computeTrackDeltas, computeArtistDeltas } from "./delta";
import type { SnapshotDate } from "@/types/contracts";

// Helper: cast string to branded type
const date = (s: string) => s as SnapshotDate;

// ── computeTrackDeltas ──────────────────────────────────────────────────────
describe("computeTrackDeltas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] when no snapshots exist in DB (auto-date path)", () => {
    mockGet.mockReturnValueOnce({ max_date: null });
    const result = computeTrackDeltas();
    expect(result).toEqual([]);
  });

  it("returns [] when no rows exist for the target date (empty all())", () => {
    // prevRow query -> no prior date
    mockGet.mockReturnValueOnce({ prev_date: null });
    // rows query for no-prev path -> empty
    mockAll.mockReturnValueOnce([]);
    const result = computeTrackDeltas(date("2024-11-24"));
    expect(result).toEqual([]);
  });

  it("returns dailyStreams=0 and previousPlaycount=currentPlaycount when no prior snapshot exists", () => {
    mockGet.mockReturnValueOnce({ prev_date: null });
    mockAll.mockReturnValueOnce([
      {
        track_id: "t1",
        track_name: "Hum Honge Kamyab",
        artist_id: "a1",
        artist_name: "KR$NA",
        album_name: "CAPO",
        current_playcount: 5_000_000,
        snapshot_date: "2024-11-24",
      },
    ]);

    const [track] = computeTrackDeltas(date("2024-11-24"));

    expect(track.dailyStreams).toBe(0);
    expect(track.previousPlaycount).toBe(5_000_000);
    expect(track.currentPlaycount).toBe(5_000_000);
  });

  it("computes positive daily streams correctly", () => {
    // prevRow query -> previous date exists
    mockGet.mockReturnValueOnce({ prev_date: "2024-11-23" });
    // rows query (join path)
    mockAll.mockReturnValueOnce([
      {
        track_id: "t1",
        track_name: "Teesri Kasam",
        artist_id: "a2",
        artist_name: "Seedhe Maut",
        album_name: "Bayaan",
        current_playcount: 10_200_000,
        previous_playcount: 10_000_000,
        snapshot_date: "2024-11-24",
      },
    ]);

    const [track] = computeTrackDeltas(date("2024-11-24"));

    expect(track.dailyStreams).toBe(200_000);
    expect(track.currentPlaycount).toBe(10_200_000);
    expect(track.previousPlaycount).toBe(10_000_000);
  });

  it("CRITICAL: clamps negative delta to 0 (never returns negative dailyStreams)", () => {
    mockGet.mockReturnValueOnce({ prev_date: "2024-11-23" });
    mockAll.mockReturnValueOnce([
      {
        track_id: "t2",
        track_name: "Bezubaan",
        artist_id: "a3",
        artist_name: "MC Stan",
        album_name: "Insaan",
        current_playcount: 8_000_000,
        previous_playcount: 8_500_000, // HIGHER than current → would be negative
        snapshot_date: "2024-11-24",
      },
    ]);

    const [track] = computeTrackDeltas(date("2024-11-24"));

    expect(track.dailyStreams).toBe(0);
    expect(track.dailyStreams).toBeGreaterThanOrEqual(0);
  });

  it("sets dailyStreams=0 when previous_playcount IS NULL in the join (new track in catalog)", () => {
    mockGet.mockReturnValueOnce({ prev_date: "2024-11-23" });
    mockAll.mockReturnValueOnce([
      {
        track_id: "t3",
        track_name: "New Drop",
        artist_id: "a1",
        artist_name: "KR$NA",
        album_name: "CAPO",
        current_playcount: 500_000,
        previous_playcount: null, // new track, no prior snapshot
        snapshot_date: "2024-11-24",
      },
    ]);

    const [track] = computeTrackDeltas(date("2024-11-24"));

    expect(track.dailyStreams).toBe(0);
    expect(track.previousPlaycount).toBe(500_000); // set to current
  });

  it("handles zero delta (no streams gained)", () => {
    mockGet.mockReturnValueOnce({ prev_date: "2024-11-23" });
    mockAll.mockReturnValueOnce([
      {
        track_id: "t4",
        track_name: "Flatline",
        artist_id: "a4",
        artist_name: "Raftaar",
        album_name: "Zero to Infinity",
        current_playcount: 3_000_000,
        previous_playcount: 3_000_000,
        snapshot_date: "2024-11-24",
      },
    ]);

    const [track] = computeTrackDeltas(date("2024-11-24"));
    expect(track.dailyStreams).toBe(0);
  });

  it("auto-resolves latest date from DB when no date arg supplied", () => {
    // 1st get: max_date for auto-resolution
    mockGet.mockReturnValueOnce({ max_date: "2024-11-24" });
    // 2nd get: prev_date query
    mockGet.mockReturnValueOnce({ prev_date: "2024-11-23" });
    // all(): join rows
    mockAll.mockReturnValueOnce([
      {
        track_id: "t5",
        track_name: "Auto Track",
        artist_id: "a5",
        artist_name: "DIVINE",
        album_name: "Kohinoor",
        current_playcount: 20_000_000,
        previous_playcount: 19_500_000,
        snapshot_date: "2024-11-24",
      },
    ]);

    const result = computeTrackDeltas(); // no date arg
    expect(result).toHaveLength(1);
    expect(result[0].dailyStreams).toBe(500_000);
    expect(result[0].snapshotDate).toBe("2024-11-24");
  });

  it("maps all contract fields correctly on the track delta object", () => {
    mockGet.mockReturnValueOnce({ prev_date: "2024-11-23" });
    mockAll.mockReturnValueOnce([
      {
        track_id: "spotify:track:ABC123",
        track_name: "Gully Boy",
        artist_id: "spotify:artist:XYZ789",
        artist_name: "DIVINE",
        album_name: "Kohinoor",
        current_playcount: 50_000_000,
        previous_playcount: 49_000_000,
        snapshot_date: "2024-11-24",
      },
    ]);

    const [track] = computeTrackDeltas(date("2024-11-24"));

    expect(track.trackId).toBe("spotify:track:ABC123");
    expect(track.trackName).toBe("Gully Boy");
    expect(track.artistId).toBe("spotify:artist:XYZ789");
    expect(track.artistName).toBe("DIVINE");
    expect(track.albumName).toBe("Kohinoor");
    expect(track.snapshotDate).toBe("2024-11-24");
    expect(track.previousDate).toBe("2024-11-23");
  });

  it("processes multiple tracks correctly in a single batch", () => {
    mockGet.mockReturnValueOnce({ prev_date: "2024-11-23" });
    mockAll.mockReturnValueOnce([
      {
        track_id: "t1",
        track_name: "Track A",
        artist_id: "a1",
        artist_name: "KR$NA",
        album_name: "CAPO",
        current_playcount: 1_100_000,
        previous_playcount: 1_000_000,
        snapshot_date: "2024-11-24",
      },
      {
        track_id: "t2",
        track_name: "Track B",
        artist_id: "a1",
        artist_name: "KR$NA",
        album_name: "CAPO",
        current_playcount: 2_200_000,
        previous_playcount: 2_000_000,
        snapshot_date: "2024-11-24",
      },
    ]);

    const result = computeTrackDeltas(date("2024-11-24"));

    expect(result).toHaveLength(2);
    expect(result[0].dailyStreams).toBe(100_000);
    expect(result[1].dailyStreams).toBe(200_000);
  });
});

// ── computeArtistDeltas ─────────────────────────────────────────────────────
describe("computeArtistDeltas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] when no artist snapshots exist (auto-date path)", () => {
    mockGet.mockReturnValueOnce({ max_date: null });
    const result = computeArtistDeltas();
    expect(result).toEqual([]);
  });

  it("computes positive listener and follower deltas", () => {
    mockGet.mockReturnValueOnce({ prev_date: "2024-11-23" });
    mockAll.mockReturnValueOnce([
      {
        spotify_id: "a1",
        name: "KR$NA",
        current_monthly_listeners: 5_200_000,
        previous_monthly_listeners: 5_000_000,
        current_followers: 1_200_000,
        previous_followers: 1_180_000,
        snapshot_date: "2024-11-24",
      },
    ]);

    const [artist] = computeArtistDeltas(date("2024-11-24"));

    expect(artist.listenerDelta).toBe(200_000);
    expect(artist.followerDelta).toBe(20_000);
    expect(artist.currentMonthlyListeners).toBe(5_200_000);
    expect(artist.previousMonthlyListeners).toBe(5_000_000);
  });

  it("allows negative listenerDelta (not clamped — audience can shrink)", () => {
    mockGet.mockReturnValueOnce({ prev_date: "2024-11-23" });
    mockAll.mockReturnValueOnce([
      {
        spotify_id: "a2",
        name: "Seedhe Maut",
        current_monthly_listeners: 4_800_000,
        previous_monthly_listeners: 5_000_000, // HIGHER than current → negative delta
        current_followers: 900_000,
        previous_followers: 905_000,
        snapshot_date: "2024-11-24",
      },
    ]);

    const [artist] = computeArtistDeltas(date("2024-11-24"));

    expect(artist.listenerDelta).toBe(-200_000); // must be negative, NOT clamped
    expect(artist.followerDelta).toBe(-5_000);
  });

  it("CRITICAL: missing previous snapshot → listenerDelta=0, previousMonthlyListeners=current", () => {
    mockGet.mockReturnValueOnce({ prev_date: null });
    mockAll.mockReturnValueOnce([
      {
        spotify_id: "a3",
        name: "MC Stan",
        monthly_listeners: 8_000_000,
        followers: 2_500_000,
        snapshot_date: "2024-11-24",
      },
    ]);

    const [artist] = computeArtistDeltas(date("2024-11-24"));

    expect(artist.listenerDelta).toBe(0);
    expect(artist.followerDelta).toBe(0);
    expect(artist.previousMonthlyListeners).toBe(8_000_000);
    expect(artist.previousFollowers).toBe(2_500_000);
  });

  it("sets previousMonthlyListeners=current when JOIN returns null previous_monthly_listeners", () => {
    mockGet.mockReturnValueOnce({ prev_date: "2024-11-23" });
    mockAll.mockReturnValueOnce([
      {
        spotify_id: "a4",
        name: "Raftaar",
        current_monthly_listeners: 3_000_000,
        previous_monthly_listeners: null, // new artist, no prior snapshot
        current_followers: 800_000,
        previous_followers: null,
        snapshot_date: "2024-11-24",
      },
    ]);

    const [artist] = computeArtistDeltas(date("2024-11-24"));

    expect(artist.listenerDelta).toBe(0);
    expect(artist.followerDelta).toBe(0);
    expect(artist.previousMonthlyListeners).toBe(3_000_000);
  });

  it("auto-resolves latest date from artist_snapshots when no arg supplied", () => {
    mockGet.mockReturnValueOnce({ max_date: "2024-11-24" });
    mockGet.mockReturnValueOnce({ prev_date: "2024-11-23" });
    mockAll.mockReturnValueOnce([
      {
        spotify_id: "a5",
        name: "DIVINE",
        current_monthly_listeners: 12_000_000,
        previous_monthly_listeners: 11_900_000,
        current_followers: 3_000_000,
        previous_followers: 2_990_000,
        snapshot_date: "2024-11-24",
      },
    ]);

    const result = computeArtistDeltas(); // no date arg
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("DIVINE");
    expect(result[0].listenerDelta).toBe(100_000);
  });

  it("maps all contract fields on the artist delta object", () => {
    mockGet.mockReturnValueOnce({ prev_date: "2024-11-23" });
    mockAll.mockReturnValueOnce([
      {
        spotify_id: "spotify:artist:KRNA",
        name: "KR$NA",
        current_monthly_listeners: 6_000_000,
        previous_monthly_listeners: 5_900_000,
        current_followers: 1_500_000,
        previous_followers: 1_490_000,
        snapshot_date: "2024-11-24",
      },
    ]);

    const [artist] = computeArtistDeltas(date("2024-11-24"));

    expect(artist.spotifyId).toBe("spotify:artist:KRNA");
    expect(artist.name).toBe("KR$NA");
    expect(artist.currentMonthlyListeners).toBe(6_000_000);
    expect(artist.listenerDelta).toBe(100_000);
    expect(artist.currentFollowers).toBe(1_500_000);
    expect(artist.followerDelta).toBe(10_000);
    expect(artist.snapshotDate).toBe("2024-11-24");
    expect(artist.previousDate).toBe("2024-11-23");
  });

  it("processes multiple artists without cross-contamination", () => {
    mockGet.mockReturnValueOnce({ prev_date: "2024-11-23" });
    mockAll.mockReturnValueOnce([
      {
        spotify_id: "a1",
        name: "KR$NA",
        current_monthly_listeners: 5_000_000,
        previous_monthly_listeners: 4_900_000,
        current_followers: 1_000_000,
        previous_followers: 995_000,
        snapshot_date: "2024-11-24",
      },
      {
        spotify_id: "a2",
        name: "Seedhe Maut",
        current_monthly_listeners: 3_000_000,
        previous_monthly_listeners: 2_950_000,
        current_followers: 700_000,
        previous_followers: 698_000,
        snapshot_date: "2024-11-24",
      },
    ]);

    const result = computeArtistDeltas(date("2024-11-24"));

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("KR$NA");
    expect(result[0].listenerDelta).toBe(100_000);
    expect(result[1].name).toBe("Seedhe Maut");
    expect(result[1].listenerDelta).toBe(50_000);
  });
});
