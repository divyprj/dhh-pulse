# ADR-002: Dual-Tier Anonymous Guest Authentication for Spotify Pathfinder

## Status
Accepted

## Date
2026-11-23

## Context
The official Spotify Web API (`api.spotify.com/v1`) intentionally hides exact track playcounts and monthly listener counts, exposing only normalized popularity scores. Exact playcounts are exclusively available through Spotify's internal Pathfinder GraphQL endpoints (`api-partner.spotify.com/pathfinder/v1/query`) utilized by the official web and desktop clients.

Accessing this internal API requires an access token. However, requiring user OAuth logins or paid third-party scraping services violates the $0 budget and automated unattended 24h cron execution requirements.

## Options Considered
1. **Registered Spotify Developer App OAuth:**
   - *Result:* Standard API tokens fail on Pathfinder GraphQL endpoints and do not expose playcount data.
2. **Paid Scraping Proxy Services (Apify, ScrapingBee):**
   - *Result:* Violates the strict $0 budget requirement.
3. **Anonymous Web Player Guest Token Minter:**
   - Querying `open.spotify.com/get_access_token`.
   - *Limitation:* Frequently blocked at the edge (HTTP 403) depending on data center or residential IP reputation.
4. **Dual-Tier Strategy (Web Player API + Embed Player Fallback):**
   - Attempt web player endpoint first. On HTTP 403, scrape anonymous session tokens from the server-rendered HTML of Spotify embed pages (`open.spotify.com/embed/artist/<id>`).

## Decision
Implement the **Dual-Tier Anonymous Guest Token Minter** (`src/lib/scraper/auth.ts`).

## Rationale
- The embed player page (`open.spotify.com/embed/artist/<id>`) contains a valid anonymous bearer token and expiration timestamp embedded within its HTML payload.
- This endpoint is globally accessible from standard server and CI/CD IP ranges without Cloudflare/Fastly edge blocking.
- Tokens are cached in-memory and renewed 60 seconds prior to expiration, minimizing unnecessary network traffic.

## Consequences
- **Positive:** Enables automated, zero-cost data extraction without API credentials or proxy subscriptions.
- **Negative:** Relies on Spotify's internal client architecture and server-rendered HTML patterns, which may change without notice and require scraper maintenance.
