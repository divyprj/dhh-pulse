# Development Guide

## 1. Prerequisites and Setup

### Required Software
- **Node.js:** v20.x or higher
- **npm:** v10.x or higher
- **Git**

### Installation Steps
```bash
# Clone the repository
git clone https://github.com/divyprj/dhh-pulse.git
cd dhh-pulse

# Install dependencies strictly from package-lock.json
npm ci

# Configure local environment variables
cp .env.example .env.local
```

---

## 2. Running Locally

### Development Server
```bash
npm run dev
```
Starts the Next.js development server at `http://localhost:3000`. In development mode (`NODE_ENV=development`), `better-sqlite3` logs all SQL queries and execution durations to standard output.

### Production Build and Execution
```bash
# Build production bundle
npm run build

# Start production server
npm run start
```

---

## 3. Running the Scraper CLI

The scraper runs standalone outside the Next.js web process:

```bash
# Full discography discovery across all active artists in registry
npm run scrape

# Quick update (fetches audience stats and updates known tracks; skips release discovery)
npx tsx scripts/scrape.ts --quick

# Scrape a single artist by Spotify Artist ID
npx tsx scripts/scrape.ts --artist 5C1S9XwxMuuCciutwMhp5t

# Override base request pacing delay (ms)
npx tsx scripts/scrape.ts --delay 4000

# View CLI options
npx tsx scripts/scrape.ts --help
```

---

## 4. Managing the Artist Registry

Tracked artists are maintained in `src/config/artists.ts`. All entries must adhere to the `ArtistRegistryEntry` interface.

To add a new artist:
1. Locate their Spotify profile URL (e.g., `https://open.spotify.com/artist/4Ai0pGz6GhQavjzaRhPTvz`).
2. Copy the Spotify Artist ID (`4Ai0pGz6GhQavjzaRhPTvz`).
3. Add an entry to the `DHH_ARTISTS` array in `src/config/artists.ts`:
   ```typescript
   {
     spotifyId: toSpotifyArtistId("4Ai0pGz6GhQavjzaRhPTvz"),
     name: "DIVINE",
     aliases: ["Vivian Fernandes"],
     active: true,
     addedAt: "2026-11-24",
   }
   ```
4. Seed their initial snapshot:
   ```bash
   npx tsx scripts/scrape.ts --artist 4Ai0pGz6GhQavjzaRhPTvz --quick
   ```

---

## 5. Direct Database Inspection

The SQLite database file resides at `data/dhh-pulse.sqlite`. It can be inspected using standard SQLite CLI tools:

```bash
sqlite3 data/dhh-pulse.sqlite

# Sample verification queries:
sqlite> SELECT COUNT(*) FROM artists;
sqlite> SELECT name, monthly_listeners, snapshot_date FROM artist_snapshots ORDER BY monthly_listeners DESC LIMIT 5;
sqlite> SELECT name, playcount, snapshot_date FROM track_snapshots ORDER BY playcount DESC LIMIT 5;
sqlite> .quit
```
