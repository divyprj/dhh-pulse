/**
 * DHH Pulse — Spotify Pathfinder Artist Scraper
 *
 * Extracts artist profile data (monthly listeners, followers, images, top cities)
 * from Spotify's internal Pathfinder GraphQL API using a guest token.
 *
 * GraphQL operation: queryArtistOverview
 */

import type {
  ScrapedArtistData,
  SpotifyArtistId,
} from "@/types/contracts";
import { SPOTIFY_ENDPOINTS, toSpotifyArtistId } from "@/types/contracts";
import { getGuestToken, invalidateGuestToken } from "./auth";

// ---------------------------------------------------------------------------
// GraphQL query for artist overview (monthly listeners, followers, images)
// ---------------------------------------------------------------------------
const ARTIST_OVERVIEW_QUERY = `
  query queryArtistOverview(
    $uri: ID!
    $locale: String
    $includePrerelease: Boolean!
  ) {
    artistUnion(uri: $uri) {
      __typename
      ... on Artist {
        id
        uri
        profile {
          name
          verified
          biography {
            text
          }
          pinnedItem {
            comment
          }
        }
        visuals {
          avatarImage {
            sources {
              url
              width
              height
            }
          }
          headerImage {
            sources {
              url
              width
              height
            }
          }
        }
        stats {
          followers
          monthlyListeners
          worldRank
          topCities {
            items {
              city
              country
              numberOfListeners
            }
          }
        }
      }
    }
  }
`;

// Raw GraphQL response shapes
interface ArtistOverviewResponse {
  data?: {
    artistUnion?: {
      __typename: string;
      id?: string;
      uri?: string;
      profile?: {
        name?: string;
        verified?: boolean;
      };
      visuals?: {
        avatarImage?: {
          sources?: Array<{ url: string; width: number; height: number }>;
        };
        headerImage?: {
          sources?: Array<{ url: string; width: number; height: number }>;
        };
      };
      stats?: {
        followers?: number;
        monthlyListeners?: number;
        worldRank?: number;
        topCities?: {
          items?: Array<{
            city: string;
            country: string;
            numberOfListeners: number;
          }>;
        };
      };
    };
  };
  errors?: Array<{ message: string }>;
}

/**
 * Fetches artist overview data from Spotify Pathfinder GraphQL.
 *
 * @param spotifyId  Spotify artist ID (e.g. "4YRxDV8wJFPHPTeXepOstw")
 * @param retries    Current retry count (internal — do not pass)
 * @returns          Scraped artist data or throws on unrecoverable error.
 */
export async function fetchArtistData(
  spotifyId: SpotifyArtistId,
  retries = 0
): Promise<ScrapedArtistData> {
  const maxRetries = 3;
  const token = await getGuestToken();

  const uri = `spotify:artist:${spotifyId}`;
  const variables = { uri, locale: "", includePrerelease: true };
  const extensions = {
    persistedQuery: {
      version: 1,
      sha256Hash:
        "591ed473fa2f5426186f8ba52dee295fe1ce32b36820d67eae045df4f9c4c4d3",
    },
  };

  const params = new URLSearchParams({
    operationName: "queryArtistOverview",
    variables: JSON.stringify(variables),
    extensions: JSON.stringify(extensions),
  });

  const url = `${SPOTIFY_ENDPOINTS.PATHFINDER_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(token.accessToken),
    });

    if (response.status === 401) {
      // Token expired — invalidate and retry once
      invalidateGuestToken();
      if (retries < maxRetries) {
        await sleep(1000);
        return fetchArtistData(spotifyId, retries + 1);
      }
      throw new Error(`Artist ${spotifyId}: auth failed after token refresh.`);
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 30);
      console.warn(
        `[artist] Rate limited for ${spotifyId}. Waiting ${retryAfter}s…`
      );
      await sleep(retryAfter * 1000);
      if (retries < maxRetries) return fetchArtistData(spotifyId, retries + 1);
      throw new Error(`Artist ${spotifyId}: rate-limited after max retries.`);
    }

    if (response.status >= 500) {
      const backoffMs = Math.pow(2, retries + 1) * 1000;
      console.warn(
        `[artist] 5xx error (${response.status}) for ${spotifyId}. Backoff ${backoffMs}ms…`
      );
      await sleep(backoffMs);
      if (retries < maxRetries) return fetchArtistData(spotifyId, retries + 1);
      throw new Error(
        `Artist ${spotifyId}: server error ${response.status} after max retries.`
      );
    }

    if (!response.ok) {
      throw new Error(
        `Artist ${spotifyId}: unexpected HTTP ${response.status}`
      );
    }

    const json = (await response.json()) as ArtistOverviewResponse;

    if (json.errors && json.errors.length > 0) {
      throw new Error(
        `Artist ${spotifyId} GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`
      );
    }

    const artist = json.data?.artistUnion;
    if (!artist || artist.__typename !== "Artist") {
      throw new Error(
        `Artist ${spotifyId}: artistUnion is not Artist — got ${artist?.__typename ?? "undefined"}`
      );
    }

    // Pick the largest avatar image URL
    const avatarSources = artist.visuals?.avatarImage?.sources ?? [];
    const avatarUrl =
      avatarSources.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ??
      null;

    // Pick the largest header image URL
    const headerSources = artist.visuals?.headerImage?.sources ?? [];
    const headerUrl =
      headerSources.sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ??
      null;

    const topCities = (artist.stats?.topCities?.items ?? []).map((c) => ({
      city: c.city,
      country: c.country,
      listeners: c.numberOfListeners,
    }));

    return {
      spotifyId: toSpotifyArtistId(spotifyId),
      name: artist.profile?.name ?? "Unknown Artist",
      monthlyListeners: artist.stats?.monthlyListeners ?? 0,
      followers: artist.stats?.followers ?? 0,
      imageUrl: avatarUrl,
      headerImageUrl: headerUrl,
      verified: artist.profile?.verified ?? false,
      topCities,
    };
  } catch (err) {
    if (retries < maxRetries && isRetryable(err)) {
      const backoffMs = Math.pow(2, retries + 1) * 1000;
      console.warn(
        `[artist] Retryable error for ${spotifyId} (attempt ${retries + 1}):`,
        err instanceof Error ? err.message : err
      );
      await sleep(backoffMs);
      return fetchArtistData(spotifyId, retries + 1);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://open.spotify.com/",
    Origin: "https://open.spotify.com",
    "spotify-app-version": "1.2.52.141.g772bb6e2",
    "app-platform": "WebPlayer",
    "content-type": "application/json;charset=UTF-8",
  };
}

function isRetryable(err: unknown): boolean {
  if (err instanceof TypeError) return true; // network error
  if (err instanceof Error) {
    return (
      err.message.includes("fetch") ||
      err.message.includes("network") ||
      err.message.includes("ECONNRESET") ||
      err.message.includes("ETIMEDOUT")
    );
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
