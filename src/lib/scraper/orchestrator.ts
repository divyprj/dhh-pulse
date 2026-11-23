/**
 * DHH Pulse — Rate-Limited Batch Scrape Orchestrator
 *
 * Processes all active artists sequentially (concurrency: 1) with:
 * - Randomized jitter between requests (2–5s baseline + jitter)
 * - Exponential backoff on transient errors
 * - Negative delta guards before persisting track snapshots
 * - Full audit trail per scrape run in the scrape_runs table
 */

import { randomUUID } from "crypto";
import type {
  ArtistRegistryEntry,
  ArtistScrapeResult,
  BatchScrapeResult,
  ScraperConfig,
} from "@/types/contracts";
import { DEFAULT_SCRAPER_CONFIG, toSnapshotDate } from "@/types/contracts";
import { getDb } from "@/lib/db/client";
import { fetchArtistData } from "./artist";
import { fetchAllArtistTracks } from "./catalog";

// ---------------------------------------------------------------------------
// Core orchestrator
// ---------------------------------------------------------------------------

/**
 * Runs a full batch scrape across all provided artists.
 * Persists results to SQLite in real time (artist + tracks per artist).
 *
 * @param artists  List of active artist registry entries to scrape.
 * @param config   Scraper rate-limit and retry configuration.
 * @param fullCatalogSync  If true, discovers new albums; if false, only updates known tracks.
 */
export async function runBatchScrape(
  artists: readonly ArtistRegistryEntry[],
  config: ScraperConfig = DEFAULT_SCRAPER_CONFIG,
  fullCatalogSync = true
): Promise<BatchScrapeResult> {
  const batchId = randomUUID();
  const startedAt = Date.now();
  const db = getDb();
  const snapshotDate = toSnapshotDate(new Date());

  console.log(
    `\n[orchestrator] ════════════════════════════════════════`
  );
  console.log(`[orchestrator] DHH Pulse — Batch Scrape Starting`);
  console.log(`[orchestrator] Batch ID  : ${batchId}`);
  console.log(`[orchestrator] Date      : ${snapshotDate}`);
  console.log(`[orchestrator] Artists   : ${artists.length}`);
  console.log(
    `[orchestrator] Config    : delay=${config.baseDelayMs}ms, jitter=${config.maxJitterMs}ms, retries=${config.maxRetries}`
  );
  console.log(
    `[orchestrator] ════════════════════════════════════════\n`
  );

  // Insert scrape run record
  const insertRun = db.prepare(`
    INSERT INTO scrape_runs (batch_id, status, started_at, total_artists)
    VALUES (?, 'running', ?, ?)
  `);
  insertRun.run(batchId, startedAt, artists.length);

  const results: ArtistScrapeResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < artists.length; i++) {
    const artist = artists[i];
    console.log(
      `\n[orchestrator] [${i + 1}/${artists.length}] Processing: ${artist.name} (${artist.spotifyId})`
    );

    let result: ArtistScrapeResult;
    try {
      result = await scrapeArtistWithRetry(
        artist,
        config,
        snapshotDate,
        fullCatalogSync
      );

      if (result.success) {
        // Persist artist snapshot
        persistArtistSnapshot(db, result, snapshotDate);
        // Persist track snapshots
        persistTrackSnapshots(db, result, snapshotDate);
        successCount++;
        console.log(
          `[orchestrator] ✓ ${artist.name}: ${result.tracks.length} tracks, ${result.artist.monthlyListeners.toLocaleString()} monthly listeners`
        );
      } else {
        failureCount++;
        console.error(
          `[orchestrator] ✗ ${artist.name}: ${result.error}`
        );
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      result = {
        artist: {
          spotifyId: artist.spotifyId,
          name: artist.name,
          monthlyListeners: 0,
          followers: 0,
          imageUrl: null,
          headerImageUrl: null,
          verified: false,
        },
        tracks: [],
        scrapedAt: Date.now(),
        success: false,
        error,
      };
      failureCount++;
      console.error(`[orchestrator] ✗ ${artist.name}: ${error}`);
    }

    results.push(result);

    // Polite inter-artist delay (skip after last artist)
    if (i < artists.length - 1) {
      const delay = config.baseDelayMs + Math.random() * config.maxJitterMs;
      console.log(
        `[orchestrator] Waiting ${Math.round(delay)}ms before next artist…`
      );
      await sleep(delay);
    }
  }

  const completedAt = Date.now();

  // Update scrape run record
  const updateRun = db.prepare(`
    UPDATE scrape_runs
    SET status = ?, completed_at = ?, success_count = ?, failure_count = ?
    WHERE batch_id = ?
  `);
  updateRun.run(
    failureCount === artists.length ? "failed" : "completed",
    completedAt,
    successCount,
    failureCount,
    batchId
  );

  const batchResult: BatchScrapeResult = {
    startedAt,
    completedAt,
    totalArtists: artists.length,
    successCount,
    failureCount,
    results,
  };

  const durationMin = ((completedAt - startedAt) / 60000).toFixed(1);
  console.log(
    `\n[orchestrator] ════════════════════════════════════════`
  );
  console.log(`[orchestrator] Batch Complete!`);
  console.log(
    `[orchestrator] Success : ${successCount}/${artists.length} artists`
  );
  console.log(
    `[orchestrator] Duration: ${durationMin} minutes`
  );
  console.log(
    `[orchestrator] ════════════════════════════════════════\n`
  );

  return batchResult;
}

// ---------------------------------------------------------------------------
// Per-artist scrape with retry & backoff
// ---------------------------------------------------------------------------

async function scrapeArtistWithRetry(
  artist: ArtistRegistryEntry,
  config: ScraperConfig,
  snapshotDate: string,
  fullCatalogSync: boolean,
  attempt = 1
): Promise<ArtistScrapeResult> {
  try {
    // Fetch artist profile
    const artistData = await fetchArtistData(artist.spotifyId);

    // Fetch tracks
    let tracks: Awaited<ReturnType<typeof fetchAllArtistTracks>> = [];
    if (fullCatalogSync) {
      tracks = await fetchAllArtistTracks(
        artist.spotifyId,
        config.baseDelayMs / 2
      );
    }

    return {
      artist: artistData,
      tracks,
      scrapedAt: Date.now(),
      success: true,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    if (attempt < config.maxRetries) {
      const backoffMs =
        Math.pow(config.backoffMultiplier, attempt) * config.baseDelayMs;
      console.warn(
        `[orchestrator] Retry ${attempt}/${config.maxRetries} for ${artist.name} in ${Math.round(backoffMs)}ms: ${error}`
      );
      await sleep(backoffMs);
      return scrapeArtistWithRetry(
        artist,
        config,
        snapshotDate,
        fullCatalogSync,
        attempt + 1
      );
    }

    return {
      artist: {
        spotifyId: artist.spotifyId,
        name: artist.name,
        monthlyListeners: 0,
        followers: 0,
        imageUrl: null,
        headerImageUrl: null,
        verified: false,
      },
      tracks: [],
      scrapedAt: Date.now(),
      success: false,
      error,
    };
  }
}

// ---------------------------------------------------------------------------
// SQLite persistence helpers
// ---------------------------------------------------------------------------

function persistArtistSnapshot(
  db: ReturnType<typeof getDb>,
  result: ArtistScrapeResult,
  snapshotDate: string
): void {
  // Upsert artist in master registry
  const upsertArtist = db.prepare(`
    INSERT INTO artists (spotify_id, name, active, added_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(spotify_id) DO UPDATE SET
      name = excluded.name,
      active = 1
  `);
  upsertArtist.run(
    result.artist.spotifyId,
    result.artist.name,
    toSnapshotDate(new Date())
  );

  // Insert artist snapshot (upsert by spotify_id + snapshot_date)
  const insertSnapshot = db.prepare(`
    INSERT INTO artist_snapshots (spotify_id, name, monthly_listeners, followers, image_url, snapshot_date)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(spotify_id, snapshot_date) DO UPDATE SET
      monthly_listeners = excluded.monthly_listeners,
      followers = excluded.followers,
      image_url = excluded.image_url
  `);
  insertSnapshot.run(
    result.artist.spotifyId,
    result.artist.name,
    result.artist.monthlyListeners,
    result.artist.followers,
    result.artist.imageUrl,
    snapshotDate
  );
}

function persistTrackSnapshots(
  db: ReturnType<typeof getDb>,
  result: ArtistScrapeResult,
  snapshotDate: string
): void {
  if (result.tracks.length === 0) return;

  const insertTrack = db.prepare(`
    INSERT INTO track_snapshots (track_id, spotify_artist_id, name, album_name, playcount, snapshot_date)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(track_id, snapshot_date) DO UPDATE SET
      playcount = excluded.playcount,
      name = excluded.name,
      album_name = excluded.album_name
  `);

  // Apply negative delta guard: get yesterday's playcounts for this artist
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayDate = toSnapshotDate(yesterday);

  const prevSnapshotsRows = db.prepare(`
    SELECT track_id, playcount FROM track_snapshots
    WHERE spotify_artist_id = ? AND snapshot_date = ?
  `).all(result.artist.spotifyId, yesterdayDate) as Array<{
    track_id: string;
    playcount: number;
  }>;

  const prevPlaycounts = new Map(
    prevSnapshotsRows.map((r) => [r.track_id, r.playcount])
  );

  // Insert all tracks in a transaction for atomicity and performance
  const insertMany = db.transaction((tracks: typeof result.tracks) => {
    for (const track of tracks) {
      const prevPlaycount = prevPlaycounts.get(track.trackId) ?? null;

      // Negative delta guard: if today's playcount is less than yesterday's,
      // it may indicate a metadata migration. We still store the raw scraped
      // value (the UI layer handles delta display), but we log it.
      if (prevPlaycount !== null && track.playcount < prevPlaycount) {
        console.warn(
          `[orchestrator] ⚠️  Negative delta for "${track.name}" (${track.trackId}): ` +
            `${prevPlaycount} → ${track.playcount} (Δ=${track.playcount - prevPlaycount})`
        );
      }

      insertTrack.run(
        track.trackId,
        result.artist.spotifyId,
        track.name,
        track.albumName,
        track.playcount,
        snapshotDate
      );
    }
  });

  insertMany(result.tracks);
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
