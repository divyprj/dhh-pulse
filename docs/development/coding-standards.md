# Coding Standards

## 1. TypeScript and Contract Conventions

- **Strict Mode:** TypeScript strict mode is enabled in `tsconfig.json`. Code must compile with zero errors (`npx tsc --noEmit`).
- **No `any` Types:** Use explicit typing or `unknown` with type guards.
- **Branded Types:** Entity identifiers (`SpotifyArtistId`, `SpotifyTrackId`, `SpotifyAlbumId`, `SnapshotDate`) use branded nominal types:
  ```typescript
  export type SpotifyArtistId = string & { readonly __brand: "SpotifyArtistId" };
  ```
  Use the typed constructors (`toSpotifyArtistId(id)`, `toSnapshotDate(date)`) to create instances safely.
- **Contract Adherence:** Import all shared models, interfaces, and DDL specifications directly from `src/types/contracts.ts`. Never define shadow interfaces in feature files.

---

## 2. Database and Security Standards

- **100% Parameterized Statements:** All SQLite operations must use prepared statement parameters (`?`). Dynamic string interpolation into SQL queries is prohibited:
  ```typescript
  // Compliant
  const row = db.prepare("SELECT * FROM artists WHERE spotify_id = ?").get(artistId);

  // Prohibited
  const row = db.prepare(`SELECT * FROM artists WHERE spotify_id = '${artistId}'`).get();
  ```
- **Connection Teardown:** CLI scripts and tests must cleanly invoke `closeDb()` in a `finally` block to release WAL locks.
- **Zero Secrets Policy:** Never commit API keys, personal access tokens, or sensitive values. Secrets must be supplied via environment variables (`.env.local`).

---

## 3. Formatting and Linting

- Follow Next.js ESLint standards:
  ```bash
  npm run lint
  ```
- Use 2-space indentation, semicolons, and trailing commas where permitted.
- Clean up unused imports and debug logs before committing.
