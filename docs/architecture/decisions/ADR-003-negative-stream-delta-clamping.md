# ADR-003: Negative Stream Delta Clamping for Catalog Deduplication Guards

## Status
Accepted

## Date
2026-11-23

## Context
Spotify does not provide a native daily stream metric. Daily streams are mathematically derived by calculating the difference between consecutive daily snapshots:

$$\Delta = \text{Playcount}_{\text{today}} - \text{Playcount}_{\text{yesterday}}$$

Under normal conditions, playcounts increase monotonically ($\Delta \ge 0$). However, music streaming platforms periodically perform metadata migrations, track deduplications (merging separate releases under a single ISRC), or remove fraudulent bot streams. In these scenarios, a track's public lifetime playcount may decrease from one day to the next, resulting in an anomalous negative daily delta.

Without defensive handling, negative deltas corrupt daily leaderboards, skew scene-wide momentum statistics, and display anomalous negative stream outputs.

## Options Considered
1. **Unclamped Signed Deltas:**
   - Display raw mathematical difference regardless of sign.
   - *Consequence:* Renders negative streams for songs, misleading users and breaking leaderboard rank algorithms.
2. **Discard Snapshot on Negative Delta:**
   - Drop the entire daily snapshot if any track exhibits a negative delta.
   - *Consequence:* Causes data gaps for the entire artist and discography.
3. **Mathematical Zero-Clamping (`Math.max(0, delta)`):**
   - Clamp negative track deltas to zero for daily stream aggregation, while preserving raw lifetime playcounts in the snapshot store.

## Decision
Enforce **strict zero-clamping for track daily stream deltas** in `src/lib/analytics/delta.ts`:

$$\text{DailyStreams} = \max\left(0, \, \text{Playcount}_t - \text{Playcount}_{t-1}\right)$$

Audience metrics (monthly listeners and followers) remain unclamped and signed, as audiences naturally expand and contract.

## Rationale
- Prevents anomalies in Spotify's internal metadata management from corrupting daily stream volume.
- Guarantees that daily stream rankings reflect positive forward streaming activity.
- Preserves raw historical playcounts in `track_snapshots` so full lifetime audit trails remain unmodified.

## Consequences
- **Positive:** Reliable, monotonic daily stream outputs across all leaderboard and trajectory components. Verified by Vitest unit tests in `src/lib/analytics/delta.test.ts`.
- **Negative:** If a track genuinely loses a significant volume of streams due to platform clawback, that specific loss is not subtracted from the artist's daily aggregate output.
