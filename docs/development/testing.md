# Testing Strategy and Test Suite

## 1. Testing Framework

DHH Pulse uses **Vitest 2.1.8** with native ESM support and global test utilities (`globals: true`).

Configuration file: [`vitest.config.ts`](../../vitest.config.ts)

---

## 2. Test Execution Commands

```bash
# Execute all unit tests once
npm test

# Run tests in watch mode during development
npm run test:watch
```

---

## 3. Test Architecture and Database Mocking Strategy

To guarantee determinism, prevent disk I/O flakiness, and avoid polluting the production SQLite database, **all unit tests isolate data layers using `vi.mock`**. No real database file is touched during unit testing.

### Mock Pattern (`@/lib/db/client`)
```typescript
const mockGet = vi.fn();
const mockAll = vi.fn();
const mockPrepare = vi.fn(() => ({ get: mockGet, all: mockAll }));
const mockDb = { prepare: mockPrepare };

vi.mock("@/lib/db/client", () => ({
  getDb: () => mockDb,
}));
```

---

## 4. Test Coverage Breakdown (48 Tests)

### 4.1. Delta Engine (`src/lib/analytics/delta.test.ts` — 18 Tests)
- **Negative Delta Clamping:** Validates that when a track's current playcount is lower than its previous playcount (due to Spotify metadata deduplication), `dailyStreams` is clamped strictly to `0` (`Math.max(0, delta)`).
- **First Snapshot Handling:** Confirms that when no previous snapshot exists, `dailyStreams` returns `0` and `previousPlaycount` equals `currentPlaycount`.
- **Calendar Date Arithmetic:** Validates previous calendar day calculations across month boundaries, leap years, and year transitions.
- **Signed Listener Deltas:** Verifies that audience listener and follower changes preserve positive and negative signs accurately.

### 4.2. Catalog Aggregator (`src/lib/analytics/aggregator.test.ts` — 9 Tests)
- **Catalog Stream Sums:** Validates that total daily streams correctly sum individual track deltas across an artist's discography.
- **Top Track Attribution:** Verifies that the song with the highest 24-hour gain is assigned as `topTrack`.
- **Historical Trajectory Points:** Confirms chronological ordering and metric alignment for Recharts time-series data.

### 4.3. Leaderboard Engine (`src/lib/analytics/leaderboard.test.ts` — 21 Tests)
- **Sort Dimensions:** Validates descending and ascending ordering across all 5 sort keys (`totalDailyStreams`, `monthlyListeners`, `listenerDelta`, `followers`, `topTrackStreams`).
- **Pagination and Offsets:** Confirms that `limit` and `offset` slice entries properly and calculate 1-based ranks (`offset + index + 1`).
- **Top Gainer Tracks:** Validates scene-wide track ranking across multiple artists.
