/**
 * DHH Pulse — SQLite Database Schema
 *
 * Creates all 4 required tables and all 5 required indexes per DB_SCHEMA_CONTRACT.
 * Runs with WAL journal mode for concurrent read performance.
 */

import type Database from "better-sqlite3";
import { DB_SCHEMA_CONTRACT } from "@/types/contracts";

// Validate that our implementation covers all required tables & indexes
const _tableCheck: (typeof DB_SCHEMA_CONTRACT.tables)[number][] = [
  "artists",
  "artist_snapshots",
  "track_snapshots",
  "scrape_runs",
];
const _indexCheck: (typeof DB_SCHEMA_CONTRACT.indexes)[number][] = [
  "idx_artist_snapshots_artist_date",
  "idx_track_snapshots_track_date",
  "idx_track_snapshots_artist_date",
  "idx_artist_snapshots_date",
  "idx_track_snapshots_date",
];
// Suppress unused variable warnings — these exist purely for compile-time contract verification
void _tableCheck;
void _indexCheck;

/**
 * Creates all tables if they do not already exist.
 * Safe to call repeatedly (idempotent).
 */
export function createSchema(db: Database.Database): void {
  // Enable WAL mode for performance
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");

  db.exec(`
    -- -------------------------------------------------------------------------
    -- Table: artists (master registry)
    -- -------------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS artists (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      spotify_id      TEXT NOT NULL UNIQUE,
      name            TEXT NOT NULL,
      aliases         TEXT,            -- JSON array of aliases
      active          INTEGER NOT NULL DEFAULT 1,  -- 0 = inactive, 1 = active
      added_at        TEXT NOT NULL,   -- ISO 8601 date
      created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    -- -------------------------------------------------------------------------
    -- Table: artist_snapshots (one row per artist per day)
    -- -------------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS artist_snapshots (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      spotify_id        TEXT NOT NULL,
      name              TEXT NOT NULL,
      monthly_listeners INTEGER NOT NULL,
      followers         INTEGER NOT NULL,
      image_url         TEXT,
      snapshot_date     TEXT NOT NULL,  -- YYYY-MM-DD
      created_at        INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      UNIQUE (spotify_id, snapshot_date)
    );

    -- -------------------------------------------------------------------------
    -- Table: track_snapshots (one row per track per day)
    -- -------------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS track_snapshots (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id          TEXT NOT NULL,
      spotify_artist_id TEXT NOT NULL,
      name              TEXT NOT NULL,
      album_name        TEXT NOT NULL,
      playcount         INTEGER NOT NULL,
      snapshot_date     TEXT NOT NULL,  -- YYYY-MM-DD
      created_at        INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      UNIQUE (track_id, snapshot_date)
    );

    -- -------------------------------------------------------------------------
    -- Table: scrape_runs (batch execution log)
    -- -------------------------------------------------------------------------
    CREATE TABLE IF NOT EXISTS scrape_runs (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id        TEXT NOT NULL UNIQUE,
      status          TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')),
      started_at      INTEGER NOT NULL,
      completed_at    INTEGER,
      total_artists   INTEGER NOT NULL DEFAULT 0,
      success_count   INTEGER NOT NULL DEFAULT 0,
      failure_count   INTEGER NOT NULL DEFAULT 0,
      error_log       TEXT,            -- JSON array of error messages
      created_at      INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    -- -------------------------------------------------------------------------
    -- Indexes (all required by DB_SCHEMA_CONTRACT)
    -- -------------------------------------------------------------------------

    -- idx_artist_snapshots_artist_date: fast per-artist time-series lookup
    CREATE INDEX IF NOT EXISTS idx_artist_snapshots_artist_date
      ON artist_snapshots (spotify_id, snapshot_date);

    -- idx_track_snapshots_track_date: fast per-track delta computation
    CREATE INDEX IF NOT EXISTS idx_track_snapshots_track_date
      ON track_snapshots (track_id, snapshot_date);

    -- idx_track_snapshots_artist_date: artist catalog daily rollup
    CREATE INDEX IF NOT EXISTS idx_track_snapshots_artist_date
      ON track_snapshots (spotify_artist_id, snapshot_date);

    -- idx_artist_snapshots_date: leaderboard queries by date
    CREATE INDEX IF NOT EXISTS idx_artist_snapshots_date
      ON artist_snapshots (snapshot_date);

    -- idx_track_snapshots_date: top gainer tracks queries by date
    CREATE INDEX IF NOT EXISTS idx_track_snapshots_date
      ON track_snapshots (snapshot_date);
  `);
}
