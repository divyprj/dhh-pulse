# System Design

## 1. Presentation and Frontend Architecture

DHH Pulse uses the Next.js 15 App Router paired with React 19.

### Server Component Strategy
- **Homepage (`src/app/page.tsx`):** Implemented as an asynchronous Server Component that queries the analytics engine directly at request time. It retrieves the latest scene ledger data, top 5 gainer tracks, and the status of the most recent batch run without exposing raw database handles to the client.
- **Track Heat Page (`src/app/tracks/page.tsx`):** A Server Component that renders scene-wide top gainer tracks ranked by 24-hour playcount increases.
- **Artist Trajectory Detail (`src/app/artists/[id]/page.tsx`):** A dynamic Server Component (`/artists/[id]`) that renders an artist's full discography, audience growth curve, and Recharts historical graphs.

### Client Component Strategy
- **Artist Directory (`src/app/artists/page.tsx`):** Implemented as a Client Component to support instant, interactive sorting across 5 dimensions, ascending/descending toggles, and live client-side name filtering without triggering round-trip page reloads.

### Layout and State
- **Shell Layout (`src/components/layout/Shell.tsx`):** Enforces a persistent sidebar navigation drawer and global header bar across all sub-pages.
- **Error Boundaries (`src/components/ui/ErrorBoundary.tsx`):** Every data-driven view is wrapped in an explicit React error boundary, preventing isolated database or chart rendering failures from crashing the global console shell.

---

## 2. Ingestion Engine Design

### The Spotify Pathfinder GraphQL Protocol
The official Spotify Web API restricts access to exact track playcounts. DHH Pulse interfaces directly with Spotify's web player backend via `https://api-partner.spotify.com/pathfinder/v1/query`.

The scraper executes three distinct operations:
1. `queryArtistOverview`: Retrieves profile metadata, monthly listener counts, follower counts, verified badges, and header images.
2. `queryArtistDiscography`: Discovers all releases associated with the artist URI (albums, singles, EPs, compilations).
3. `getAlbum`: Fetches individual album contents, extracting track URIs and their exact lifetime playcounts.

### Guest Token Minter Architecture (`src/lib/scraper/auth.ts`)
To operate without Spotify API developer credentials or paid scraping proxies:
- **Primary Transport:** Queries `https://open.spotify.com/get_access_token?reason=transport&productType=web_player`.
- **Secondary Fallback:** If the primary endpoint returns an HTTP 403 (edge network block), the minter fetches `https://open.spotify.com/embed/artist/<id>` and extracts embedded access tokens directly from the server-rendered HTML.
- **Expiration Buffer:** Tokens are cached in-process and refreshed 60 seconds prior to expiration (`expiresAtMs - 60000`).

### Pacing and Jitter
To prevent IP blocks and rate limits (HTTP 429) on residential connections:
- Scraper runs are strictly sequential (`concurrency: 1`).
- Every network request sleeps for a baseline delay of 2,000ms plus a pseudo-random jitter of up to 3,000ms ($2\text{s} - 5\text{s}$ pause).
- Transient failures trigger exponential backoff with up to 3 retries.

---

## 3. Concurrency and Process Boundaries

- **Single Database Connection:** The SQLite database is accessed via a single connection instance per Node.js process managed by `src/lib/db/client.ts`.
- **Single-Flight Scrape Mutex:** In `src/app/api/scrape/route.ts`, a module-scoped boolean lock (`syncInFlight`) ensures that only one scrape batch can execute at any time. Concurrent requests receive an immediate `409 Conflict` response.
- **Decoupled CLI Execution:** The standalone runner `scripts/scrape.ts` executes in a separate Node.js process, bypassing the web server entirely during scheduled GitHub Actions runs.
