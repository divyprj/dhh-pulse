/**
 * DHH Pulse — Analytics Engine: 24h Delta Calculator
 *
 * Implements daily delta computations for tracks and artists:
 * - Compares target date vs previous available snapshot date
 * - Clamps negative playcount deltas to 0 (metadata migration guard)
 * - Handles missing previous-day data gracefully (returns 0 delta, previous = current)
 * - Uses parameterized SQLite queries with better-sqlite3
 */

import { getDb } from "@/lib/db/client";
import type {
  ArtistDelta,
  SnapshotDate,
  SpotifyArtistId,
  SpotifyTrackId,
  TrackDelta,
} from "@/types/contracts";
import {
  toSpotifyArtistId,
  toSpotifyTrackId,
} from "@/types/contracts";

/**
 * Calculates calendar day before a given date string (YYYY-MM-DD).
 */
function getPreviousCalendarDay(dateStr: string): SnapshotDate {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0] as SnapshotDate;
}

/**
 * Computes 24h playcount deltas for all tracks on the target date.
 * If date is omitted, uses the latest available snapshot date in track_snapshots.
 *
 * Daily stream formula:
 *   dailyStreams = Math.max(0, currentPlaycount - previousPlaycount)
 *
 * If no prior snapshot exists for a track, dailyStreams = 0 and previousPlaycount = currentPlaycount.
 */
export function computeTrackDeltas(date?: SnapshotDate): TrackDelta[] {
  const db = getDb();

  let targetDate = date;
  if (!targetDate) {
    const latestRow = db
      .prepare(`SELECT MAX(snapshot_date) as max_date FROM track_snapshots`)
      .get() as { max_date: string | null } | undefined;

    if (!latestRow || !latestRow.max_date) {
      return [];
    }
    targetDate = latestRow.max_date as SnapshotDate;
  }

  // Find previous available snapshot date before targetDate
  const prevRow = db
    .prepare(
      `SELECT MAX(snapshot_date) as prev_date FROM track_snapshots WHERE snapshot_date < ?`
    )
    .get(targetDate) as { prev_date: string | null } | undefined;

  const prevDate = prevRow?.prev_date;
  const previousDate: SnapshotDate = prevDate
    ? (prevDate as SnapshotDate)
    : getPreviousCalendarDay(targetDate);

  if (!prevDate) {
    // No prior snapshot exists in DB at all for any track before targetDate
    const rows = db
      .prepare(
        `SELECT 
          curr.track_id,
          curr.name AS track_name,
          curr.spotify_artist_id AS artist_id,
          COALESCE(art.name, curr_art.name, 'Unknown Artist') AS artist_name,
          curr.album_name,
          curr.playcount AS current_playcount,
          curr.snapshot_date
        FROM track_snapshots curr
        LEFT JOIN artists art 
          ON curr.spotify_artist_id = art.spotify_id
        LEFT JOIN artist_snapshots curr_art 
          ON curr.spotify_artist_id = curr_art.spotify_id 
          AND curr_art.snapshot_date = curr.snapshot_date
        WHERE curr.snapshot_date = ?
        ORDER BY curr.track_id ASC`
      )
      .all(targetDate) as Array<{
        track_id: string;
        track_name: string;
        artist_id: string;
        artist_name: string;
        album_name: string;
        current_playcount: number;
        snapshot_date: string;
      }>;

    return rows.map((row) => ({
      trackId: toSpotifyTrackId(row.track_id),
      trackName: row.track_name,
      artistId: toSpotifyArtistId(row.artist_id),
      artistName: row.artist_name,
      albumName: row.album_name,
      currentPlaycount: row.current_playcount,
      previousPlaycount: row.current_playcount,
      dailyStreams: 0,
      snapshotDate: row.snapshot_date as SnapshotDate,
      previousDate,
    }));
  }

  // Prior snapshot date exists — join current vs previous playcounts
  const rows = db
    .prepare(
      `SELECT 
        curr.track_id,
        curr.name AS track_name,
        curr.spotify_artist_id AS artist_id,
        COALESCE(art.name, curr_art.name, 'Unknown Artist') AS artist_name,
        curr.album_name,
        curr.playcount AS current_playcount,
        prev.playcount AS previous_playcount,
        curr.snapshot_date
      FROM track_snapshots curr
      LEFT JOIN track_snapshots prev 
        ON curr.track_id = prev.track_id 
        AND prev.snapshot_date = ?
      LEFT JOIN artists art 
        ON curr.spotify_artist_id = art.spotify_id
      LEFT JOIN artist_snapshots curr_art 
        ON curr.spotify_artist_id = curr_art.spotify_id 
        AND curr_art.snapshot_date = curr.snapshot_date
      WHERE curr.snapshot_date = ?
      ORDER BY curr.track_id ASC`
    )
    .all(prevDate, targetDate) as Array<{
      track_id: string;
      track_name: string;
      artist_id: string;
      artist_name: string;
      album_name: string;
      current_playcount: number;
      previous_playcount: number | null;
      snapshot_date: string;
    }>;

  return rows.map((row) => {
    const hasPrevious =
      row.previous_playcount !== null && row.previous_playcount !== undefined;
    const previousPlaycount = hasPrevious
      ? row.previous_playcount!
      : row.current_playcount;
    const dailyStreams = hasPrevious
      ? Math.max(0, row.current_playcount - row.previous_playcount!)
      : 0;

    return {
      trackId: toSpotifyTrackId(row.track_id),
      trackName: row.track_name,
      artistId: toSpotifyArtistId(row.artist_id),
      artistName: row.artist_name,
      albumName: row.album_name,
      currentPlaycount: row.current_playcount,
      previousPlaycount,
      dailyStreams,
      snapshotDate: row.snapshot_date as SnapshotDate,
      previousDate,
    };
  });
}

/**
 * Computes 24h audience metric deltas for artists on the target date.
 * If date is omitted, uses the latest available snapshot date in artist_snapshots.
 *
 * Listener delta formula:
 *   listenerDelta = currentMonthlyListeners - previousMonthlyListeners (can be negative)
 *   followerDelta = currentFollowers - previousFollowers (can be negative)
 *
 * If no prior snapshot exists for an artist, deltas return 0 and previous = current.
 */
export function computeArtistDeltas(date?: SnapshotDate): ArtistDelta[] {
  const db = getDb();

  let targetDate = date;
  if (!targetDate) {
    const latestRow = db
      .prepare(`SELECT MAX(snapshot_date) as max_date FROM artist_snapshots`)
      .get() as { max_date: string | null } | undefined;

    if (!latestRow || !latestRow.max_date) {
      return [];
    }
    targetDate = latestRow.max_date as SnapshotDate;
  }

  // Find previous available snapshot date before targetDate
  const prevRow = db
    .prepare(
      `SELECT MAX(snapshot_date) as prev_date FROM artist_snapshots WHERE snapshot_date < ?`
    )
    .get(targetDate) as { prev_date: string | null } | undefined;

  const prevDate = prevRow?.prev_date;
  const previousDate: SnapshotDate = prevDate
    ? (prevDate as SnapshotDate)
    : getPreviousCalendarDay(targetDate);

  if (!prevDate) {
    // No prior snapshot exists in DB at all for any artist before targetDate
    const rows = db
      .prepare(
        `SELECT 
          spotify_id,
          name,
          monthly_listeners,
          followers,
          snapshot_date
        FROM artist_snapshots
        WHERE snapshot_date = ?
        ORDER BY name ASC`
      )
      .all(targetDate) as Array<{
        spotify_id: string;
        name: string;
        monthly_listeners: number;
        followers: number;
        snapshot_date: string;
      }>;

    return rows.map((row) => ({
      spotifyId: toSpotifyArtistId(row.spotify_id),
      name: row.name,
      currentMonthlyListeners: row.monthly_listeners,
      previousMonthlyListeners: row.monthly_listeners,
      listenerDelta: 0,
      currentFollowers: row.followers,
      previousFollowers: row.followers,
      followerDelta: 0,
      snapshotDate: row.snapshot_date as SnapshotDate,
      previousDate,
    }));
  }

  // Prior snapshot date exists — join current vs previous artist stats
  const rows = db
    .prepare(
      `SELECT 
        curr.spotify_id,
        curr.name,
        curr.monthly_listeners AS current_monthly_listeners,
        prev.monthly_listeners AS previous_monthly_listeners,
        curr.followers AS current_followers,
        prev.followers AS previous_followers,
        curr.snapshot_date
      FROM artist_snapshots curr
      LEFT JOIN artist_snapshots prev
        ON curr.spotify_id = prev.spotify_id
        AND prev.snapshot_date = ?
      WHERE curr.snapshot_date = ?
      ORDER BY curr.name ASC`
    )
    .all(prevDate, targetDate) as Array<{
      spotify_id: string;
      name: string;
      current_monthly_listeners: number;
      previous_monthly_listeners: number | null;
      current_followers: number;
      previous_followers: number | null;
      snapshot_date: string;
    }>;

  return rows.map((row) => {
    const hasPrevListeners =
      row.previous_monthly_listeners !== null &&
      row.previous_monthly_listeners !== undefined;
    const previousMonthlyListeners = hasPrevListeners
      ? row.previous_monthly_listeners!
      : row.current_monthly_listeners;
    const listenerDelta = hasPrevListeners
      ? row.current_monthly_listeners - row.previous_monthly_listeners!
      : 0;

    const hasPrevFollowers =
      row.previous_followers !== null &&
      row.previous_followers !== undefined;
    const previousFollowers = hasPrevFollowers
      ? row.previous_followers!
      : row.current_followers;
    const followerDelta = hasPrevFollowers
      ? row.current_followers - row.previous_followers!
      : 0;

    return {
      spotifyId: toSpotifyArtistId(row.spotify_id),
      name: row.name,
      currentMonthlyListeners: row.current_monthly_listeners,
      previousMonthlyListeners,
      listenerDelta,
      currentFollowers: row.current_followers,
      previousFollowers,
      followerDelta,
      snapshotDate: row.snapshot_date as SnapshotDate,
      previousDate,
    };
  });
}
