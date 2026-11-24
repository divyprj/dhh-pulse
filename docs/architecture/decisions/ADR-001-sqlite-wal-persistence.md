# ADR-001: SQLite with WAL Journal Mode for Zero-Cost High-Throughput Persistence

## Status
Accepted

## Date
2026-11-23

## Context
DHH Pulse requires long-term persistence for daily stream playcounts, listener counts, and catalog discographies across 20+ artists (scaling to 200+ artists). The platform must operate under a strict $0 budget constraint, precluding paid hosted database solutions (e.g., managed PostgreSQL, cloud MongoDB, or Redis clusters). Furthermore, the application must run cross-platform on Linux, macOS, and Windows with minimal operational friction.

## Options Considered
1. **Remote Managed PostgreSQL (Supabase / Neon free tiers):**
   - *Advantages:* Standard relational engine, networked access.
   - *Disadvantages:* Subject to connection pool limits, free-tier compute pausing/cold-starts, potential subscription fees at scale, and external network dependency.
2. **Local SQLite 3 via `better-sqlite3` with WAL Mode:**
   - *Advantages:* $0 cost, zero network overhead, synchronous fast execution, embedded in process, single-file backup, native support across platforms.
   - *Disadvantages:* Local file-based, requiring volume persistence or git/cache synchronization in containerized or CI/CD environments.

## Decision
Adopt **SQLite 3 via `better-sqlite3` configured with Write-Ahead Logging (`WAL`) mode**.

## Rationale
- Setting `PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;` allows concurrent readers to query leaderboards and charts without locking or being blocked by background batch scraper inserts.
- The single-file database (`data/dhh-pulse.sqlite`) eliminates network latency and third-party hosting dependencies.
- In GitHub Actions automation, the database file is easily restored from cache and committed back to the repository.

## Consequences
- **Positive:** Zero hosting costs, deterministic local execution, ultra-fast queries (<5ms) for complex aggregations.
- **Negative:** The application cannot be deployed to ephemeral serverless runtimes (such as AWS Lambda or Vercel Serverless) without a persistent volume or remote database sync layer. Deployment requires a long-lived Node.js process (e.g. VPS, Docker, or self-hosted server).
