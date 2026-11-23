/**
 * DHH Pulse — Central Domain Contracts
 *
 * 🔒 THIS FILE IS READ-ONLY.
 * Workers must NEVER modify this file directly.
 * If a contract is insufficient, emit BLOCKED_CONTRACT_MISMATCH
 * to request an architectural review from the Chief Architect.
 *
 * @author Divyansh (Chief Architect)
 * @version 1.0.0
 */

// ============================================================================
// 1. ARTIST REGISTRY & IDENTITY
// ============================================================================

/** Spotify Artist ID — the canonical unique identifier from Spotify */
export type SpotifyArtistId = string & { readonly __brand: "SpotifyArtistId" };

/** Spotify Track ID */
export type SpotifyTrackId = string & { readonly __brand: "SpotifyTrackId" };

/** Spotify Album ID */
export type SpotifyAlbumId = string & { readonly __brand: "SpotifyAlbumId" };

/** ISO 8601 date string (YYYY-MM-DD) used for snapshot dates */
export type SnapshotDate = string & { readonly __brand: "SnapshotDate" };

/** Unix timestamp in milliseconds */
export type UnixTimestampMs = number;

/**
 * Artist registry entry — the source-of-truth for tracked artists.
 * Stored in `src/config/artists.ts` and seeded into the database.
 */
export interface ArtistRegistryEntry {
  /** Spotify Artist ID (e.g., "4YRxDV8wJFPHPTeXepOstw") */
  readonly spotifyId: SpotifyArtistId;
  /** Display name (e.g., "KR$NA") */
  readonly name: string;
  /** Optional aliases for search and display (e.g., ["Krishna Kaul"]) */
  readonly aliases?: readonly string[];
  /** Whether this artist is actively tracked */
  readonly active: boolean;
  /** Date added to registry (ISO 8601) */
  readonly addedAt: string;
}

// ============================================================================
// 2. SPOTIFY SCRAPER — RAW DATA SHAPES
// ============================================================================

/**
 * Guest authentication token from Spotify's open access point.
 * These tokens are short-lived (~1 hour) and require no user auth.
 */
export interface SpotifyGuestToken {
  readonly accessToken: string;
  readonly expiresAtMs: UnixTimestampMs;
  readonly clientId: string;
}

/**
 * Raw artist data extracted from Spotify Pathfinder GraphQL.
 * This is the shape returned by the scraper before DB normalization.
 */
export interface ScrapedArtistData {
  readonly spotifyId: SpotifyArtistId;
  readonly name: string;
  readonly monthlyListeners: number;
  readonly followers: number;
  readonly imageUrl: string | null;
  readonly headerImageUrl: string | null;
  /** Verified artist badge */
  readonly verified: boolean;
  /** Top city listener data if available */
  readonly topCities?: readonly ScrapedCityListeners[];
}

export interface ScrapedCityListeners {
  readonly city: string;
  readonly country: string;
  readonly listeners: number;
}

/**
 * Raw track data extracted from Spotify Pathfinder.
 * Includes the exact playcount that the official API hides.
 */
export interface ScrapedTrackData {
  readonly trackId: SpotifyTrackId;
  readonly name: string;
  readonly artistIds: readonly SpotifyArtistId[];
  readonly artistNames: readonly string[];
  readonly albumId: SpotifyAlbumId;
  readonly albumName: string;
  readonly durationMs: number;
  readonly playcount: number;
  readonly discNumber: number;
  readonly trackNumber: number;
  readonly releaseDate: string;
  readonly isExplicit: boolean;
}

/**
 * Complete scrape result for a single artist — their profile + full discography.
 */
export interface ArtistScrapeResult {
  readonly artist: ScrapedArtistData;
  readonly tracks: readonly ScrapedTrackData[];
  readonly scrapedAt: UnixTimestampMs;
  readonly success: boolean;
  readonly error?: string;
}

// ============================================================================
// 3. SCRAPER ORCHESTRATOR — BATCH EXECUTION
// ============================================================================

/**
 * Configuration for the scraper orchestrator's rate limiting.
 */
export interface ScraperConfig {
  /** Base delay between requests in ms (default: 2000) */
  readonly baseDelayMs: number;
  /** Maximum random jitter added to base delay in ms (default: 3000) */
  readonly maxJitterMs: number;
  /** Maximum retry attempts on transient errors (default: 3) */
  readonly maxRetries: number;
  /** Backoff multiplier for retries (default: 2) */
  readonly backoffMultiplier: number;
  /** Maximum concurrent artists to process (default: 1 — sequential) */
  readonly concurrency: number;
}

/**
 * Result of a full batch scrape run across all tracked artists.
 */
export interface BatchScrapeResult {
  readonly startedAt: UnixTimestampMs;
  readonly completedAt: UnixTimestampMs;
  readonly totalArtists: number;
  readonly successCount: number;
  readonly failureCount: number;
  readonly results: readonly ArtistScrapeResult[];
}

// ============================================================================
// 4. DATABASE SCHEMA — SNAPSHOT MODELS
// ============================================================================

/**
 * Artist snapshot — one row per artist per day.
 * This is the core time-series record for artist-level metrics.
 */
export interface ArtistSnapshot {
  readonly id: number;
  readonly spotifyId: SpotifyArtistId;
  readonly name: string;
  readonly monthlyListeners: number;
  readonly followers: number;
  readonly imageUrl: string | null;
  readonly snapshotDate: SnapshotDate;
  readonly createdAt: UnixTimestampMs;
}

/**
 * Track snapshot — one row per track per day.
 * Stores the exact playcount for delta computation.
 */
export interface TrackSnapshot {
  readonly id: number;
  readonly trackId: SpotifyTrackId;
  readonly spotifyArtistId: SpotifyArtistId;
  readonly name: string;
  readonly albumName: string;
  readonly playcount: number;
  readonly snapshotDate: SnapshotDate;
  readonly createdAt: UnixTimestampMs;
}

// ============================================================================
// 5. ANALYTICS — DELTA ENGINE & AGGREGATIONS
// ============================================================================

/**
 * Computed 24-hour delta for a single track.
 * Derived from: today's playcount - yesterday's playcount.
 */
export interface TrackDelta {
  readonly trackId: SpotifyTrackId;
  readonly trackName: string;
  readonly artistId: SpotifyArtistId;
  readonly artistName: string;
  readonly albumName: string;
  readonly currentPlaycount: number;
  readonly previousPlaycount: number;
  /** Daily stream gain. Clamped to 0 on negative deltas (metadata migration guard). */
  readonly dailyStreams: number;
  readonly snapshotDate: SnapshotDate;
  readonly previousDate: SnapshotDate;
}

/**
 * Computed 24-hour delta for an artist's audience metrics.
 */
export interface ArtistDelta {
  readonly spotifyId: SpotifyArtistId;
  readonly name: string;
  readonly currentMonthlyListeners: number;
  readonly previousMonthlyListeners: number;
  /** Net listener change. Can be negative (legitimate audience fluctuation). */
  readonly listenerDelta: number;
  readonly currentFollowers: number;
  readonly previousFollowers: number;
  readonly followerDelta: number;
  readonly snapshotDate: SnapshotDate;
  readonly previousDate: SnapshotDate;
}

/**
 * Artist-level aggregation — total daily streams across entire catalog.
 */
export interface ArtistDailyAggregate {
  readonly spotifyId: SpotifyArtistId;
  readonly name: string;
  readonly imageUrl: string | null;
  readonly totalDailyStreams: number;
  readonly trackCount: number;
  readonly topTrack: {
    readonly trackId: SpotifyTrackId;
    readonly name: string;
    readonly dailyStreams: number;
  } | null;
  readonly monthlyListeners: number;
  readonly listenerDelta: number;
  readonly followers: number;
  readonly snapshotDate: SnapshotDate;
}

// ============================================================================
// 6. LEADERBOARD & RANKING CONTRACTS
// ============================================================================

/** Sort dimensions for the artist leaderboard */
export type LeaderboardSortKey =
  | "totalDailyStreams"
  | "monthlyListeners"
  | "listenerDelta"
  | "followers"
  | "topTrackStreams";

/** Sort direction */
export type SortDirection = "asc" | "desc";

/**
 * Query parameters for the artist leaderboard.
 */
export interface LeaderboardQuery {
  readonly sortBy: LeaderboardSortKey;
  readonly direction: SortDirection;
  readonly limit: number;
  readonly offset: number;
  readonly date?: SnapshotDate;
}

/**
 * A single row in the artist leaderboard.
 */
export interface LeaderboardEntry {
  readonly rank: number;
  readonly artist: ArtistDailyAggregate;
}

/**
 * Paginated leaderboard response.
 */
export interface LeaderboardResponse {
  readonly entries: readonly LeaderboardEntry[];
  readonly total: number;
  readonly query: LeaderboardQuery;
  readonly generatedAt: UnixTimestampMs;
}

// ============================================================================
// 7. TOP GAINER TRACKS
// ============================================================================

/**
 * Top gaining tracks across the entire scene for a given day.
 */
export interface TopGainerTracksQuery {
  readonly limit: number;
  readonly offset: number;
  readonly date?: SnapshotDate;
}

export interface TopGainerTrackEntry {
  readonly rank: number;
  readonly track: TrackDelta;
}

export interface TopGainerTracksResponse {
  readonly entries: readonly TopGainerTrackEntry[];
  readonly total: number;
  readonly query: TopGainerTracksQuery;
  readonly generatedAt: UnixTimestampMs;
}

// ============================================================================
// 8. ARTIST DETAIL & TRAJECTORY
// ============================================================================

/**
 * Time-series data point for trajectory charts.
 */
export interface TimeSeriesPoint {
  readonly date: SnapshotDate;
  readonly value: number;
}

/** Available time-series metric types */
export type TimeSeriesMetric =
  | "monthlyListeners"
  | "followers"
  | "totalDailyStreams";

/**
 * Artist trajectory data for historical comparison charts.
 */
export interface ArtistTrajectory {
  readonly spotifyId: SpotifyArtistId;
  readonly name: string;
  readonly metric: TimeSeriesMetric;
  readonly dataPoints: readonly TimeSeriesPoint[];
  readonly periodStart: SnapshotDate;
  readonly periodEnd: SnapshotDate;
}

/**
 * Artist detail view — full profile with current stats and history.
 */
export interface ArtistDetailView {
  readonly artist: ArtistDailyAggregate;
  readonly recentTracks: readonly TrackDelta[];
  readonly trajectory: {
    readonly listeners: ArtistTrajectory;
    readonly streams: ArtistTrajectory;
  };
  readonly catalogSize: number;
}

// ============================================================================
// 9. API ROUTE CONTRACTS
// ============================================================================

/**
 * Scrape trigger API request body.
 */
export interface ScrapeRequest {
  /** Optional: specific artist IDs to scrape. Empty = all active artists. */
  readonly artistIds?: readonly SpotifyArtistId[];
  /** Whether to run a full catalog discovery (slower) or quick update. */
  readonly fullCatalogSync: boolean;
}

/**
 * Scrape trigger API response.
 */
export interface ScrapeResponse {
  readonly status: "started" | "already_running" | "error";
  readonly message: string;
  readonly batchId?: string;
}

/**
 * Standard API error response shape.
 */
export interface ApiErrorResponse {
  readonly error: string;
  readonly code: string;
  readonly statusCode: number;
}

// ============================================================================
// 10. DATABASE DDL CONTRACT — SQLITE TABLE SCHEMAS
// ============================================================================

/**
 * SQL DDL statements for the SQLite schema.
 * Workers implementing `src/lib/db/schema.ts` MUST create exactly these tables.
 */
export const DB_SCHEMA_CONTRACT = {
  tables: [
    "artists",          // Artist registry (master list)
    "artist_snapshots",  // Daily artist metric snapshots
    "track_snapshots",   // Daily track playcount snapshots
    "scrape_runs",       // Batch scrape execution log
  ] as const,

  /**
   * Required indexes for query performance.
   * Workers MUST create these indexes in schema.ts.
   */
  indexes: [
    "idx_artist_snapshots_artist_date",   // (spotify_id, snapshot_date)
    "idx_track_snapshots_track_date",      // (track_id, snapshot_date)
    "idx_track_snapshots_artist_date",     // (spotify_artist_id, snapshot_date)
    "idx_artist_snapshots_date",           // (snapshot_date)
    "idx_track_snapshots_date",            // (snapshot_date)
  ] as const,
} as const;

// ============================================================================
// 11. UI COMPONENT PROP CONTRACTS
// ============================================================================

/**
 * Props for the ArtistTable leaderboard component.
 */
export interface ArtistTableProps {
  readonly entries: readonly LeaderboardEntry[];
  readonly sortBy: LeaderboardSortKey;
  readonly direction: SortDirection;
  readonly onSort: (key: LeaderboardSortKey) => void;
  readonly isLoading: boolean;
}

/**
 * Props for the TrackTable component (top gainers).
 */
export interface TrackTableProps {
  readonly entries: readonly TopGainerTrackEntry[];
  readonly isLoading: boolean;
}

/**
 * Props for the DeltaBadge component.
 * Displays a +/- delta with color coding.
 */
export interface DeltaBadgeProps {
  readonly value: number;
  /** Format: "number" for raw counts, "percent" for percentage change */
  readonly format: "number" | "percent";
  /** Size variant */
  readonly size: "sm" | "md" | "lg";
}

/**
 * Props for trajectory/history charts.
 */
export interface TrajectoryChartProps {
  readonly trajectories: readonly ArtistTrajectory[];
  readonly metric: TimeSeriesMetric;
  readonly height?: number;
}

/**
 * Props for the daily stream bar chart.
 */
export interface DailyStreamChartProps {
  readonly data: readonly TimeSeriesPoint[];
  readonly artistName: string;
  readonly height?: number;
}

// ============================================================================
// 12. CONFIGURATION CONSTANTS
// ============================================================================

/** Default scraper configuration — polite, $0-budget-safe */
export const DEFAULT_SCRAPER_CONFIG: ScraperConfig = {
  baseDelayMs: 2000,
  maxJitterMs: 3000,
  maxRetries: 3,
  backoffMultiplier: 2,
  concurrency: 1,
};

/** Spotify Pathfinder endpoints */
export const SPOTIFY_ENDPOINTS = {
  /** Guest token endpoint */
  TOKEN_URL: "https://open.spotify.com/get_access_token?reason=transport&productType=web_player",
  /** Pathfinder GraphQL endpoint */
  PATHFINDER_URL: "https://api-partner.spotify.com/pathfinder/v1/query",
  /** Web player base URL */
  WEB_PLAYER_BASE: "https://open.spotify.com",
} as const;

/** Pagination defaults */
export const PAGINATION_DEFAULTS = {
  LEADERBOARD_PAGE_SIZE: 50,
  TOP_TRACKS_PAGE_SIZE: 100,
  MAX_PAGE_SIZE: 200,
} as const;

/** Snapshot date format helper type guard */
export function isSnapshotDate(value: string): value is SnapshotDate {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Create a typed SnapshotDate from a Date object */
export function toSnapshotDate(date: Date): SnapshotDate {
  return date.toISOString().split("T")[0] as SnapshotDate;
}

/** Create a typed SpotifyArtistId */
export function toSpotifyArtistId(id: string): SpotifyArtistId {
  return id as SpotifyArtistId;
}

/** Create a typed SpotifyTrackId */
export function toSpotifyTrackId(id: string): SpotifyTrackId {
  return id as SpotifyTrackId;
}

/** Create a typed SpotifyAlbumId */
export function toSpotifyAlbumId(id: string): SpotifyAlbumId {
  return id as SpotifyAlbumId;
}
