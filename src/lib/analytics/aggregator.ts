/**
 * DHH Pulse — Analytics Engine: Catalog Aggregator & Trajectory Engine
 *
 * Implements:
 * 1. aggregateArtistDailyStreams(date?: SnapshotDate): ArtistDailyAggregate[]
 *    - Aggregates daily stream gains across an artist's full track discography
 *    - Identifies top track per artist (highest daily stream gain)
 *    - Merges catalog stream metrics with audience stats (listeners, delta, followers, image)
 * 2. getArtistTrajectory(spotifyId, metric, startDate?, endDate?): ArtistTrajectory
 *    - Produces chronological TimeSeriesPoint[] for charts (monthlyListeners, followers, totalDailyStreams)
 * 3. getArtistDetail(spotifyId): ArtistDetailView | null
 *    - Assembles complete profile, recent track deltas, 30-day trajectories, and total catalog size
 */

import { getDb } from "@/lib/db/client";
import { computeArtistDeltas, computeTrackDeltas } from "./delta";
import type {
  ArtistDailyAggregate,
  ArtistDetailView,
  ArtistTrajectory,
  SnapshotDate,
  SpotifyArtistId,
  SpotifyTrackId,
  TimeSeriesMetric,
  TimeSeriesPoint,
  TrackDelta,
} from "@/types/contracts";
import {
  toSnapshotDate,
  toSpotifyArtistId,
} from "@/types/contracts";

/**
 * Aggregates daily streams across all tracks per artist and combines with audience metrics.
 * If date is omitted, defaults to the latest available snapshot date.
 */
export function aggregateArtistDailyStreams(
  date?: SnapshotDate
): ArtistDailyAggregate[] {
  const db = getDb();

  let targetDate = date;
  if (!targetDate) {
    const latestArtistRow = db
      .prepare(`SELECT MAX(snapshot_date) as max_date FROM artist_snapshots`)
      .get() as { max_date: string | null } | undefined;
    const latestTrackRow = db
      .prepare(`SELECT MAX(snapshot_date) as max_date FROM track_snapshots`)
      .get() as { max_date: string | null } | undefined;

    const maxDate = latestArtistRow?.max_date ?? latestTrackRow?.max_date;
    if (!maxDate) {
      return [];
    }
    targetDate = maxDate as SnapshotDate;
  }

  // 1. Get track deltas for target date
  const trackDeltas = computeTrackDeltas(targetDate);

  // Group track deltas by artistId
  const artistTracks = new Map<string, TrackDelta[]>();
  for (const track of trackDeltas) {
    const list = artistTracks.get(track.artistId);
    if (list) {
      list.push(track);
    } else {
      artistTracks.set(track.artistId, [track]);
    }
  }

  // 2. Get artist audience deltas
  const artistDeltas = computeArtistDeltas(targetDate);
  const artistDeltaMap = new Map(
    artistDeltas.map((ad) => [ad.spotifyId as string, ad])
  );

  // 3. Query artist snapshots on targetDate for image_url and base profile info
  const artistSnapshots = db
    .prepare(
      `SELECT spotify_id, name, monthly_listeners, followers, image_url, snapshot_date
       FROM artist_snapshots
       WHERE snapshot_date = ?`
    )
    .all(targetDate) as Array<{
      spotify_id: string;
      name: string;
      monthly_listeners: number;
      followers: number;
      image_url: string | null;
      snapshot_date: string;
    }>;

  const snapshotMap = new Map(
    artistSnapshots.map((row) => [row.spotify_id, row])
  );

  // Collect all unique artist IDs across snapshots and tracks
  const allArtistIds = new Set<string>([
    ...snapshotMap.keys(),
    ...artistTracks.keys(),
  ]);

  const aggregates: ArtistDailyAggregate[] = [];

  for (const artistIdStr of allArtistIds) {
    const artistId = toSpotifyArtistId(artistIdStr);
    const snap = snapshotMap.get(artistIdStr);
    const delta = artistDeltaMap.get(artistIdStr);
    const tracks = artistTracks.get(artistIdStr) ?? [];

    let totalDailyStreams = 0;
    let topTrack: {
      trackId: SpotifyTrackId;
      name: string;
      dailyStreams: number;
    } | null = null;

    if (tracks.length > 0) {
      // Find track with highest dailyStreams (tiebreaker: highest currentPlaycount)
      for (const t of tracks) {
        totalDailyStreams += t.dailyStreams;
        if (
          !topTrack ||
          t.dailyStreams > topTrack.dailyStreams ||
          (t.dailyStreams === topTrack.dailyStreams &&
            t.currentPlaycount >
              (tracks.find((x) => x.trackId === topTrack!.trackId)
                ?.currentPlaycount ?? 0))
        ) {
          topTrack = {
            trackId: t.trackId,
            name: t.trackName,
            dailyStreams: t.dailyStreams,
          };
        }
      }
    }

    // Artist name and image resolution
    let name = snap?.name;
    const imageUrl = snap?.image_url ?? null;

    if (!name) {
      // Fallback: master artists table or tracks
      const artistMaster = db
        .prepare(`SELECT name FROM artists WHERE spotify_id = ?`)
        .get(artistIdStr) as { name: string } | undefined;
      name = artistMaster?.name ?? tracks[0]?.artistName ?? "Unknown Artist";
    }

    aggregates.push({
      spotifyId: artistId,
      name,
      imageUrl,
      totalDailyStreams,
      trackCount: tracks.length,
      topTrack,
      monthlyListeners: snap?.monthly_listeners ?? 0,
      listenerDelta: delta?.listenerDelta ?? 0,
      followers: snap?.followers ?? 0,
      snapshotDate: targetDate,
    });
  }

  return aggregates;
}

/**
 * Returns chronological historical time-series data points for an artist.
 * Metrics supported: 'monthlyListeners', 'followers', 'totalDailyStreams'.
 */
export function getArtistTrajectory(
  spotifyId: SpotifyArtistId,
  metric: TimeSeriesMetric,
  startDate?: SnapshotDate,
  endDate?: SnapshotDate
): ArtistTrajectory {
  const db = getDb();

  // Find artist name
  const artistRow = db
    .prepare(`SELECT name FROM artists WHERE spotify_id = ?`)
    .get(spotifyId) as { name: string } | undefined;

  let artistName = artistRow?.name;
  if (!artistName) {
    const snapRow = db
      .prepare(
        `SELECT name FROM artist_snapshots WHERE spotify_id = ? ORDER BY snapshot_date DESC LIMIT 1`
      )
      .get(spotifyId) as { name: string } | undefined;
    artistName = snapRow?.name ?? "Unknown Artist";
  }

  const dataPoints: TimeSeriesPoint[] = [];

  if (metric === "monthlyListeners" || metric === "followers") {
    let query = `
      SELECT snapshot_date, monthly_listeners, followers
      FROM artist_snapshots
      WHERE spotify_id = ?
    `;
    const params: unknown[] = [spotifyId];

    if (startDate) {
      query += ` AND snapshot_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND snapshot_date <= ?`;
      params.push(endDate);
    }
    query += ` ORDER BY snapshot_date ASC`;

    const rows = db.prepare(query).all(...params) as Array<{
      snapshot_date: string;
      monthly_listeners: number;
      followers: number;
    }>;

    for (const r of rows) {
      dataPoints.push({
        date: r.snapshot_date as SnapshotDate,
        value:
          metric === "monthlyListeners"
            ? r.monthly_listeners
            : r.followers,
      });
    }
  } else if (metric === "totalDailyStreams") {
    // Total daily streams across entire catalog for this artist
    let query = `
      WITH track_diffs AS (
        SELECT
          track_id,
          snapshot_date,
          playcount,
          LAG(playcount) OVER (
            PARTITION BY track_id 
            ORDER BY snapshot_date ASC
          ) AS prev_playcount
        FROM track_snapshots
        WHERE spotify_artist_id = ?
      )
      SELECT
        snapshot_date,
        SUM(
          CASE 
            WHEN prev_playcount IS NOT NULL AND playcount > prev_playcount 
              THEN playcount - prev_playcount
            ELSE 0 
          END
        ) AS total_daily_streams
      FROM track_diffs
      WHERE 1 = 1
    `;
    const params: unknown[] = [spotifyId];

    if (startDate) {
      query += ` AND snapshot_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      query += ` AND snapshot_date <= ?`;
      params.push(endDate);
    }
    query += ` GROUP BY snapshot_date ORDER BY snapshot_date ASC`;

    const rows = db.prepare(query).all(...params) as Array<{
      snapshot_date: string;
      total_daily_streams: number;
    }>;

    for (const r of rows) {
      dataPoints.push({
        date: r.snapshot_date as SnapshotDate,
        value: Number(r.total_daily_streams),
      });
    }
  }

  const periodStart: SnapshotDate =
    startDate ??
    (dataPoints.length > 0
      ? dataPoints[0].date
      : toSnapshotDate(new Date()));

  const periodEnd: SnapshotDate =
    endDate ??
    (dataPoints.length > 0
      ? dataPoints[dataPoints.length - 1].date
      : toSnapshotDate(new Date()));

  return {
    spotifyId,
    name: artistName,
    metric,
    dataPoints,
    periodStart,
    periodEnd,
  };
}

/**
 * Returns full artist detail view with current stats, recent tracks, 30-day trajectories, and catalog size.
 * Returns null if the artist cannot be found.
 */
export function getArtistDetail(
  spotifyId: SpotifyArtistId
): ArtistDetailView | null {
  const db = getDb();

  // Check if artist exists in registry or snapshots
  const artistInDb = db
    .prepare(
      `SELECT 1 FROM artists WHERE spotify_id = ?
       UNION
       SELECT 1 FROM artist_snapshots WHERE spotify_id = ?
       LIMIT 1`
    )
    .get(spotifyId, spotifyId);

  if (!artistInDb) {
    return null;
  }

  // Find latest snapshot date for this artist
  const latestArtistSnap = db
    .prepare(
      `SELECT MAX(snapshot_date) as max_date FROM artist_snapshots WHERE spotify_id = ?`
    )
    .get(spotifyId) as { max_date: string | null } | undefined;

  const latestTrackSnap = db
    .prepare(
      `SELECT MAX(snapshot_date) as max_date FROM track_snapshots WHERE spotify_artist_id = ?`
    )
    .get(spotifyId) as { max_date: string | null } | undefined;

  const latestDateStr = latestArtistSnap?.max_date ?? latestTrackSnap?.max_date;
  if (!latestDateStr) {
    return null;
  }
  const latestDate = latestDateStr as SnapshotDate;

  // Get artist daily aggregate for latestDate
  const allAggregates = aggregateArtistDailyStreams(latestDate);
  const artistAggregate = allAggregates.find((a) => a.spotifyId === spotifyId);
  if (!artistAggregate) {
    return null;
  }

  // Get track deltas for this artist on latestDate
  const allTrackDeltas = computeTrackDeltas(latestDate);
  const recentTracks = allTrackDeltas
    .filter((t) => t.artistId === spotifyId)
    .sort((a, b) => {
      if (b.dailyStreams !== a.dailyStreams) {
        return b.dailyStreams - a.dailyStreams;
      }
      return b.currentPlaycount - a.currentPlaycount;
    });

  // Calculate 30 days prior for trajectory
  const d = new Date(latestDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 30);
  const startDate30 = d.toISOString().split("T")[0] as SnapshotDate;

  const listenersTrajectory = getArtistTrajectory(
    spotifyId,
    "monthlyListeners",
    startDate30,
    latestDate
  );
  const streamsTrajectory = getArtistTrajectory(
    spotifyId,
    "totalDailyStreams",
    startDate30,
    latestDate
  );

  // Total unique catalog size
  const catalogRow = db
    .prepare(
      `SELECT COUNT(DISTINCT track_id) as count FROM track_snapshots WHERE spotify_artist_id = ?`
    )
    .get(spotifyId) as { count: number } | undefined;

  const catalogSize = Number(catalogRow?.count ?? artistAggregate.trackCount);

  return {
    artist: artistAggregate,
    recentTracks,
    trajectory: {
      listeners: listenersTrajectory,
      streams: streamsTrajectory,
    },
    catalogSize,
  };
}
