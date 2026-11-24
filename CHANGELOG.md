# Changelog

All notable changes to the DHH Pulse platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to Semantic Versioning where applicable.

---

## [0.1.0] - 2026-11-24

### Added
- Central domain contracts authored in `src/types/contracts.ts` defining immutable TypeScript types for entities, scraper configs, database models, and API interfaces.
- SQLite persistence engine using `better-sqlite3` configured with WAL journal mode (`PRAGMA journal_mode = WAL`), foreign keys enabled, and five specialized query indexes.
- Spotify Pathfinder GraphQL scraper querying `queryArtistOverview`, `queryArtistDiscography`, and `getAlbum`.
- Resilient guest token minter (`src/lib/scraper/auth.ts`) with dual-tier fallback to Spotify embed pages and in-memory expiration caching.
- Rate limiter and batch orchestrator with 2,000ms baseline delay, up to 3,000ms randomized jitter, and exponential backoff retry.
- Analytics delta engine computing 24-hour playcount changes with negative delta clamping (`Math.max(0, delta)`) to guard against catalog metadata deduplication anomalies.
- Catalog aggregator computing artist-level daily stream rollups, top track attribution, and 30-day historical trajectory series.
- Leaderboard engine supporting 5 sort dimensions (`totalDailyStreams`, `monthlyListeners`, `listenerDelta`, `followers`, `topTrackStreams`) with pagination.
- Complete Next.js 15 App Router interface featuring Scene Ledger (`/`), Artist Directory (`/artists`), Artist Deep-Dive (`/artists/[id]`), and Track Heat (`/tracks`).
- High-contrast dark console design system implementing the Frontend Craft Triad (Taste-Skill, Impeccable, Emil Kowalski Motion Physics) with WCAG AA compliance and 44x44px touch targets.
- Vitest unit testing suite with 48 tests passing across `delta.test.ts`, `aggregator.test.ts`, and `leaderboard.test.ts`.
- Standalone CLI runner `scripts/scrape.ts` supporting full catalog discovery, quick updates, and single-artist targeted scraping.
- Comprehensive technical documentation suite adhering to the Repository Engineering specification.

### Changed
- Promoted verified `team` branch commits to `main` as the canonical default branch.
- Updated task status records in `.agent-state/tasks/T-106.json` and `T-107.json` to reflect completed test and QA phases.

### Fixed
- Corrected Spotify Artist IDs in registry to ensure valid Pathfinder GraphQL queries across all 21 tracked artists.
- Enforced 44x44px minimum touch targets on table controls and filter reset triggers.
