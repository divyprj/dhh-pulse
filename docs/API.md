# DHH Pulse — API Specification

The DHH Pulse HTTP API provides programmatic access to Desi Hip Hop stream analytics, artist leaderboards, and scraper triggers. Built on the Next.js 15 App Router, all endpoints execute on the Node.js runtime with zero external server dependencies.

---

## 1. Overview & Base Configuration

- **Base URL:** `http://localhost:3000` (or configured deployment domain)
- **Content-Type:** `application/json`
- **Cache Strategy:** Real-time data endpoints return `Cache-Control: no-store, max-age=0` to guarantee fresh snapshot views.
- **Runtime:** Node.js (`export const runtime = "nodejs"`)

---

## 2. Endpoints

### 2.1. `GET /api/artists`

Retrieves the paginated artist leaderboard ranked by daily stream gains, monthly listeners, follower counts, or listener growth.

#### Request Specification

- **Method:** `GET`
- **URL:** `/api/artists`
- **Authentication:** None (Public read-only)

#### Query Parameters

| Parameter | Type | Required | Default | Allowed Values / Constraints | Description |
|---|---|---|---|---|---|
| `sortBy` | `string` | No | `totalDailyStreams` | `totalDailyStreams`, `monthlyListeners`, `listenerDelta`, `followers`, `topTrackStreams` | Sort dimension for ranking. |
| `direction` | `string` | No | `desc` | `asc`, `desc` | Sort order. |
| `limit` | `integer` | No | `50` | `1` to `200` | Number of artist records per page. |
| `offset` | `integer` | No | `0` | $\ge 0$ | Zero-based pagination offset. |
| `date` | `string` | No | Latest snapshot | `YYYY-MM-DD` (ISO 8601 Date) | Target snapshot date for historical view. |

#### Response Headers

```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store, max-age=0
X-Pulse-Sort: totalDailyStreams:desc
```

#### Response Body (`LeaderboardResponse`)

```json
{
  "entries": [
    {
      "rank": 1,
      "artist": {
        "spotifyId": "5C1S9XwxMuuCciutwMhp5t",
        "name": "KR$NA",
        "imageUrl": "https://i.scdn.co/image/ab6761610000e5eb...",
        "totalDailyStreams": 2854300,
        "trackCount": 142,
        "topTrack": {
          "trackId": "4vUjDq...",
          "name": "Prarthana",
          "dailyStreams": 215400
        },
        "monthlyListeners": 4120500,
        "listenerDelta": 18400,
        "followers": 1950000,
        "snapshotDate": "2026-11-24"
      }
    }
  ],
  "total": 21,
  "query": {
    "sortBy": "totalDailyStreams",
    "direction": "desc",
    "limit": 50,
    "offset": 0,
    "date": "2026-11-24"
  },
  "generatedAt": 1795510200000
}
```

#### Error Response (500 Internal Server Error)

```json
{
  "error": "Leaderboard query failed. The snapshot store did not answer.",
  "code": "LEADERBOARD_QUERY_FAILED",
  "statusCode": 500
}
```

#### Example cURL

```bash
curl -X GET "http://localhost:3000/api/artists?sortBy=totalDailyStreams&direction=desc&limit=10" \
  -H "Accept: application/json"
```

---

### 2.2. `POST /api/scrape`

Triggers a background batch scrape across the active artist registry or a targeted subset of artists.

#### Request Specification

- **Method:** `POST`
- **URL:** `/api/scrape`
- **Authentication:** Optional/Conditional. When `SCRAPE_TRIGGER_TOKEN` is set in the environment, requests must provide either:
  - Header: `x-scrape-token: <token>`
  - Header: `Authorization: Bearer <token>`
- **Execution Mode:** Detached / Asynchronous. Returns `202 Accepted` immediately while the scrape orchestrator processes in the background.

#### Request Headers

```http
Content-Type: application/json
x-scrape-token: your-secret-token  # Required only if SCRAPE_TRIGGER_TOKEN is set
```

#### Request Body (`ScrapeRequest`)

```json
{
  "artistIds": ["5C1S9XwxMuuCciutwMhp5t", "2oBG74gAocPMFv6Ij9ykdo"],
  "fullCatalogSync": true
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `artistIds` | `string[]` | No | All active | Optional array of Spotify Artist IDs. When omitted, all active artists in `src/config/artists.ts` are processed. |
| `fullCatalogSync` | `boolean` | No | `true` | When `true`, runs deep catalog discovery for all singles and albums. When `false`, updates audience stats and known tracks only. |

#### Responses

##### 1. Success (202 Accepted)

Returned when the batch job is successfully enqueued.

```json
{
  "status": "started",
  "message": "Sync queued for 2 artists (full catalog). Snapshots land artist by artist."
}
```

##### 2. Concurrency Conflict (409 Conflict)

Returned when a previous scrape job is currently in progress.

```json
{
  "status": "already_running",
  "message": "A sync is already running. Wait for the current pass to finish."
}
```

##### 3. Unauthorized (401 Unauthorized)

Returned when `SCRAPE_TRIGGER_TOKEN` is configured on the server, but the client provided an invalid or missing token.

```json
{
  "error": "Missing or invalid scrape trigger token.",
  "code": "SCRAPE_UNAUTHORIZED",
  "statusCode": 401
}
```

##### 4. Bad Request (400 Bad Request)

Returned when no active artists match the provided `artistIds` array.

```json
{
  "status": "error",
  "message": "No active artists matched this request."
}
```

#### Example cURL

```bash
# Trigger full batch scrape
curl -X POST "http://localhost:3000/api/scrape" \
  -H "Content-Type: application/json" \
  -H "x-scrape-token: your-secret-token" \
  -d '{"fullCatalogSync": true}'
```

---

## 3. Data Contracts & Type Schema

All API contracts are strongly typed in [`src/types/contracts.ts`](../src/types/contracts.ts).

### TypeScript Definitions

```typescript
export interface ScrapeRequest {
  readonly artistIds?: readonly SpotifyArtistId[];
  readonly fullCatalogSync: boolean;
}

export interface ScrapeResponse {
  readonly status: "started" | "already_running" | "error";
  readonly message: string;
  readonly batchId?: string;
}

export interface LeaderboardQuery {
  readonly sortBy: LeaderboardSortKey;
  readonly direction: SortDirection;
  readonly limit: number;
  readonly offset: number;
  readonly date?: SnapshotDate;
}

export interface LeaderboardResponse {
  readonly entries: readonly LeaderboardEntry[];
  readonly total: number;
  readonly query: LeaderboardQuery;
  readonly generatedAt: UnixTimestampMs;
}
```
