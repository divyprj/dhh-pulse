# HTTP API Reference

The DHH Pulse application exposes REST endpoints under `/api`. All endpoints run on the Node.js runtime (`export const runtime = "nodejs"`) and use explicit `Cache-Control: no-store` headers to ensure data fresh from SQLite snapshots.

---

## 1. Endpoints

### 1.1. `GET /api/artists`

Returns a paginated list of artists ranked according to selected performance dimensions.

#### Request Specification
- **Method:** `GET`
- **Path:** `/api/artists`
- **Authentication:** None (Public)

#### Query Parameters

| Parameter | Type | Required | Default | Allowed Values / Constraints | Description |
|---|---|---|---|---|---|
| `sortBy` | `string` | No | `totalDailyStreams` | `totalDailyStreams`, `monthlyListeners`, `listenerDelta`, `followers`, `topTrackStreams` | Primary metric used for ranking artists. |
| `direction` | `string` | No | `desc` | `asc`, `desc` | Sort order direction. |
| `limit` | `integer` | No | `50` | `1` to `200` | Number of artist records per response page. Clamped to minimum 1 and maximum 200. |
| `offset` | `integer` | No | `0` | $\ge 0$ | Zero-based pagination offset index. |
| `date` | `string` | No | Latest date | `YYYY-MM-DD` | Target snapshot date. If omitted, uses the most recent snapshot in the database. |

#### Response Headers
```http
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store, max-age=0
X-Pulse-Sort: totalDailyStreams:desc
```

#### Success Response Body (`LeaderboardResponse`)
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

#### Failure Response (500 Internal Server Error)
```json
{
  "error": "Leaderboard query failed. The snapshot store did not answer.",
  "code": "LEADERBOARD_QUERY_FAILED",
  "statusCode": 500
}
```

---

### 1.2. `POST /api/scrape`

Triggers an asynchronous batch scrape across active artists in the registry.

#### Request Specification
- **Method:** `POST`
- **Path:** `/api/scrape`
- **Authentication:** Conditional. Required if `SCRAPE_TRIGGER_TOKEN` is configured on the host. Provide token via header:
  - `x-scrape-token: <token>` OR
  - `Authorization: Bearer <token>`
- **Execution Mode:** Non-blocking (`202 Accepted`). The batch runs detached in the background while writing snapshots to SQLite.

#### Request Body (`ScrapeRequest`)
```json
{
  "artistIds": ["5C1S9XwxMuuCciutwMhp5t", "2oBG74gAocPMFv6Ij9ykdo"],
  "fullCatalogSync": true
}
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `artistIds` | `string[]` | No | All active | Array of Spotify Artist IDs. If omitted or empty, all active artists in `src/config/artists.ts` are targeted. |
| `fullCatalogSync` | `boolean` | No | `true` | When `true`, runs full album and track discovery. When `false`, updates audience stats and known tracks only. |

#### HTTP Status Codes

| Status Code | Reason | Response Body Shape |
|---|---|---|
| `202 Accepted` | Batch started successfully. | `{"status": "started", "message": "Sync queued for N artists..."}` |
| `400 Bad Request` | No active artists matched request. | `{"status": "error", "message": "No active artists matched this request."}` |
| `401 Unauthorized` | Invalid or missing token. | `{"error": "Missing or invalid scrape trigger token.", "code": "SCRAPE_UNAUTHORIZED", "statusCode": 401}` |
| `409 Conflict` | Another scrape is already running. | `{"status": "already_running", "message": "A sync is already running. Wait for the current pass to finish."}` |

---

## 2. Standard Error Response Shape

All error responses adhere to the `ApiErrorResponse` interface defined in `src/types/contracts.ts`:

```typescript
export interface ApiErrorResponse {
  readonly error: string;
  readonly code: string;
  readonly statusCode: number;
}
```
