/**
 * DHH Pulse — Spotify Guest Token Minter & Cache
 *
 * Acquires short-lived (~1h) anonymous Spotify tokens so the Pathfinder
 * GraphQL API can be queried without a user login.
 *
 * Two sources, tried in order:
 *
 *   1. The legacy web-player endpoint
 *      `https://open.spotify.com/get_access_token`
 *      Spotify frequently blocks this path at the edge (HTTP 403
 *      "URL Blocked") depending on the caller's IP, so it is only a
 *      best-effort first attempt.
 *
 *   2. The embed player
 *      `https://open.spotify.com/embed/artist/<id>`
 *      Spotify's embed pages still ship a valid anonymous token in their
 *      server-rendered HTML (`accessToken` + `accessTokenExpirationTimestampMs`).
 *      This works from networks where the legacy endpoint is blocked.
 *
 * Tokens are cached in-process until shortly before expiry to minimise
 * round-trips and reduce the chance of being rate-limited.
 */

import type { SpotifyGuestToken } from "@/types/contracts";
import { SPOTIFY_ENDPOINTS } from "@/types/contracts";

/** Embed player base — the token is scraped from an artist embed page. */
const EMBED_ARTIST_URL = "https://open.spotify.com/embed/artist";

/**
 * Stable, high-traffic public artists used only to bootstrap a token.
 * Any valid artist ID works; several are listed so a single takedown or
 * rename does not break authentication.
 */
const EMBED_SEED_IDS = [
  "5C1S9XwxMuuCciutwMhp5t", // KR$NA
  "4Ai0pGz6GhQavjzaRhPTvz", // DIVINE
  "0y59o4v8uw5crbN9M3JiL1", // Badshah
] as const;

// In-memory cache (per-process)
let _cachedToken: SpotifyGuestToken | null = null;

/** Buffer: refresh the token 60 seconds before it expires */
const EXPIRY_BUFFER_MS = 60_000;

/** Per-request network timeout. */
const REQUEST_TIMEOUT_MS = 15_000;

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://open.spotify.com/",
  Origin: "https://open.spotify.com",
  "spotify-app-version": "1.2.52.141.g772bb6e2",
  "app-platform": "WebPlayer",
};

/**
 * Raw shape returned by the legacy Spotify guest token endpoint.
 */
interface RawTokenResponse {
  clientId: string;
  accessToken: string;
  accessTokenExpirationTimestampMs: number;
  isAnonymous: boolean;
}

/**
 * Returns a valid Spotify guest access token.
 * Uses the in-memory cache; re-mints only when expired or not set.
 */
export async function getGuestToken(): Promise<SpotifyGuestToken> {
  const now = Date.now();

  // Return cached token if still valid
  if (_cachedToken && _cachedToken.expiresAtMs - EXPIRY_BUFFER_MS > now) {
    return _cachedToken;
  }

  const token = await mintGuestToken();
  _cachedToken = token;
  return token;
}

/**
 * Mints a fresh token: legacy endpoint first, embed page as the fallback.
 * Collects every failure so the final error explains what was tried.
 */
async function mintGuestToken(): Promise<SpotifyGuestToken> {
  const failures: string[] = [];

  try {
    return await mintFromLegacyEndpoint();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failures.push(`legacy: ${message}`);
    console.warn(
      `[auth] Legacy token endpoint unavailable (${message.slice(0, 120)}). ` +
        "Falling back to the embed player token."
    );
  }

  for (const seedId of EMBED_SEED_IDS) {
    try {
      return await mintFromEmbed(seedId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`embed/${seedId}: ${message}`);
    }
  }

  throw new Error(`Guest token unavailable — ${failures.join(" | ")}`);
}

/**
 * Fetches a guest token from the legacy web player endpoint.
 * A single attempt: the endpoint is either open or edge-blocked.
 */
async function mintFromLegacyEndpoint(): Promise<SpotifyGuestToken> {
  const response = await fetch(SPOTIFY_ENDPOINTS.TOKEN_URL, {
    method: "GET",
    headers: {
      ...BROWSER_HEADERS,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 160)}`);
  }

  const raw = (await response.json()) as RawTokenResponse;

  if (!raw.accessToken || !raw.accessTokenExpirationTimestampMs) {
    throw new Error(
      `unexpected response shape — ${JSON.stringify(raw).slice(0, 160)}`
    );
  }

  const token: SpotifyGuestToken = {
    accessToken: raw.accessToken,
    expiresAtMs: raw.accessTokenExpirationTimestampMs,
    clientId: raw.clientId ?? "",
  };

  console.log(
    `[auth] Guest token acquired (legacy). Expires ${new Date(token.expiresAtMs).toISOString()}`
  );

  return token;
}

/**
 * Scrapes an anonymous token from a Spotify embed page.
 * The token is embedded in the server-rendered HTML payload.
 */
async function mintFromEmbed(seedId: string): Promise<SpotifyGuestToken> {
  const response = await fetch(`${EMBED_ARTIST_URL}/${seedId}`, {
    method: "GET",
    headers: {
      ...BROWSER_HEADERS,
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const html = await response.text();

  const accessToken = /"accessToken":"([^"]+)"/.exec(html)?.[1];
  const expiresAtMs = /"accessTokenExpirationTimestampMs":(\d+)/.exec(html)?.[1];
  const clientId = /"clientId":"([^"]+)"/.exec(html)?.[1] ?? "";

  if (!accessToken || !expiresAtMs) {
    throw new Error("embed page did not contain an access token");
  }

  const token: SpotifyGuestToken = {
    accessToken,
    expiresAtMs: Number(expiresAtMs),
    clientId,
  };

  console.log(
    `[auth] Guest token acquired (embed). Expires ${new Date(token.expiresAtMs).toISOString()}`
  );

  return token;
}

/**
 * Invalidates the cached guest token, forcing re-mint on next call.
 * Call this when a 401 is received from the Pathfinder API.
 */
export function invalidateGuestToken(): void {
  _cachedToken = null;
  console.log("[auth] Guest token cache invalidated.");
}
