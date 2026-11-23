/**
 * DHH Pulse — Spotify Guest Token Minter & Cache
 *
 * Acquires short-lived (~1h) Spotify guest tokens via the open web player
 * endpoint (no user auth required). Caches the token until expiry to minimize
 * round-trips and reduce IP-block risk.
 *
 * Endpoint: https://open.spotify.com/get_access_token?reason=transport&productType=web_player
 */

import type { SpotifyGuestToken } from "@/types/contracts";
import { SPOTIFY_ENDPOINTS } from "@/types/contracts";

// In-memory cache (per-process)
let _cachedToken: SpotifyGuestToken | null = null;

/** Buffer: refresh the token 60 seconds before it expires */
const EXPIRY_BUFFER_MS = 60_000;

/**
 * Raw shape returned by the Spotify guest token endpoint.
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
 * Fetches a fresh guest token from Spotify's open web player endpoint.
 * Implements retry with exponential backoff for 5xx errors.
 */
async function mintGuestToken(attempt = 1): Promise<SpotifyGuestToken> {
  const maxAttempts = 3;

  try {
    const response = await fetch(SPOTIFY_ENDPOINTS.TOKEN_URL, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://open.spotify.com/",
        Origin: "https://open.spotify.com",
        "spotify-app-version": "1.2.52.141.g772bb6e2",
        "app-platform": "WebPlayer",
      },
    });

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 30);
      console.warn(`[auth] Rate limited. Waiting ${retryAfter}s before retry.`);
      await sleep(retryAfter * 1000);
      if (attempt < maxAttempts) return mintGuestToken(attempt + 1);
      throw new Error("Guest token: rate limited after max retries.");
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "(no body)");
      throw new Error(
        `Guest token HTTP ${response.status}: ${body.slice(0, 200)}`
      );
    }

    const raw = (await response.json()) as RawTokenResponse;

    if (!raw.accessToken || !raw.accessTokenExpirationTimestampMs) {
      throw new Error(
        `Guest token: unexpected response shape — ${JSON.stringify(raw).slice(0, 200)}`
      );
    }

    const token: SpotifyGuestToken = {
      accessToken: raw.accessToken,
      expiresAtMs: raw.accessTokenExpirationTimestampMs,
      clientId: raw.clientId,
    };

    console.log(
      `[auth] Guest token acquired. Expires at ${new Date(token.expiresAtMs).toISOString()}`
    );

    return token;
  } catch (err) {
    if (attempt < maxAttempts) {
      const backoffMs = Math.pow(2, attempt) * 1000;
      console.warn(
        `[auth] Token mint attempt ${attempt} failed. Retrying in ${backoffMs}ms…`,
        err instanceof Error ? err.message : err
      );
      await sleep(backoffMs);
      return mintGuestToken(attempt + 1);
    }
    throw err;
  }
}

/**
 * Invalidates the cached guest token, forcing re-mint on next call.
 * Call this when a 401 is received from the Pathfinder API.
 */
export function invalidateGuestToken(): void {
  _cachedToken = null;
  console.log("[auth] Guest token cache invalidated.");
}

/** Utility sleep */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
