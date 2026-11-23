/**
 * DHH Pulse — Spotify Pathfinder Catalog Discovery
 *
 * Discovers an artist's full discography (albums, singles, EPs, compilations)
 * via the Pathfinder GraphQL API, then fetches all tracks for each release.
 *
 * GraphQL operation: queryArtistDiscography
 */

import type {
  ScrapedTrackData,
  SpotifyAlbumId,
  SpotifyArtistId,
} from "@/types/contracts";
import {
  SPOTIFY_ENDPOINTS,
  toSpotifyAlbumId,
} from "@/types/contracts";
import { getGuestToken, invalidateGuestToken } from "./auth";
import { fetchAlbumTracks } from "./tracks";

// ---------------------------------------------------------------------------
// GraphQL: Artist discography (albums + singles)
// ---------------------------------------------------------------------------
const ARTIST_DISCOGRAPHY_QUERY = `
  query queryArtistDiscographyAll(
    $uri: ID!
    $offset: Int!
    $limit: Int!
  ) {
    artistUnion(uri: $uri) {
      __typename
      ... on Artist {
        discography {
          all(offset: $offset, limit: $limit) {
            totalCount
            items {
              releases {
                items {
                  id
                  uri
                  name
                  type
                  date {
                    isoString
                    precision
                  }
                  coverArt {
                    sources {
                      url
                      width
                      height
                    }
                  }
                  tracks {
                    totalCount
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Raw response shapes
interface DiscographyResponse {
  data?: {
    artistUnion?: {
      __typename: string;
      discography?: {
        all?: {
          totalCount?: number;
          items?: Array<{
            releases?: {
              items?: Array<{
                id?: string;
                uri?: string;
                name?: string;
                type?: string;
                date?: { isoString?: string; precision?: string };
                coverArt?: {
                  sources?: Array<{ url: string; width: number; height: number }>;
                };
                tracks?: { totalCount?: number };
              }>;
            };
          }>;
        };
      };
    };
  };
  errors?: Array<{ message: string }>;
}

export interface AlbumEntry {
  albumId: SpotifyAlbumId;
  albumName: string;
  albumType: string; // "ALBUM" | "SINGLE" | "COMPILATION"
  releaseDate: string;
  trackCount: number;
}

/**
 * Discovers the full discography for a Spotify artist.
 * Returns a flat list of album entries (albums, singles, EPs, compilations).
 *
 * @param spotifyId  Spotify artist ID
 * @param retries    Internal retry counter
 */
export async function fetchArtistDiscography(
  spotifyId: SpotifyArtistId,
  retries = 0
): Promise<AlbumEntry[]> {
  const maxRetries = 3;
  const pageSize = 50;
  const allAlbums: AlbumEntry[] = [];

  let offset = 0;
  let totalCount = Infinity;

  while (offset < totalCount) {
    const page = await fetchDiscographyPage(
      spotifyId,
      offset,
      pageSize,
      retries,
      maxRetries
    );
    allAlbums.push(...page.albums);
    totalCount = page.totalCount;
    offset += pageSize;
    if (page.albums.length === 0) break;
  }

  // Deduplicate by albumId (Spotify sometimes returns the same album multiple times)
  const seen = new Set<string>();
  return allAlbums.filter((a) => {
    if (seen.has(a.albumId)) return false;
    seen.add(a.albumId);
    return true;
  });
}

/**
 * Fetches all tracks across an artist's entire discography.
 * Deduplicates tracks (same trackId) across albums (e.g., appears on multiple compilations).
 *
 * @param spotifyId  Spotify artist ID
 * @param delayMs    Delay between album requests (polite scraping)
 */
export async function fetchAllArtistTracks(
  spotifyId: SpotifyArtistId,
  delayMs = 1500
): Promise<ScrapedTrackData[]> {
  const albums = await fetchArtistDiscography(spotifyId);
  console.log(
    `[catalog] Artist ${spotifyId}: found ${albums.length} releases.`
  );

  const allTracks: ScrapedTrackData[] = [];
  const seenTrackIds = new Set<string>();

  for (const album of albums) {
    try {
      const tracks = await fetchAlbumTracks(
        album.albumId,
        album.albumName,
        album.releaseDate
      );

      let newTracks = 0;
      for (const track of tracks) {
        if (!seenTrackIds.has(track.trackId)) {
          seenTrackIds.add(track.trackId);
          allTracks.push(track);
          newTracks++;
        }
      }

      console.log(
        `[catalog]   ${album.albumName} (${album.albumType}): ${tracks.length} tracks (${newTracks} new).`
      );
    } catch (err) {
      console.error(
        `[catalog]   Failed to fetch tracks for album ${album.albumName} (${album.albumId}):`,
        err instanceof Error ? err.message : err
      );
      // Continue with next album rather than failing entire artist
    }

    // Polite delay between album requests
    if (delayMs > 0) {
      await sleep(delayMs + Math.random() * 1000);
    }
  }

  return allTracks;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface DiscographyPage {
  albums: AlbumEntry[];
  totalCount: number;
}

async function fetchDiscographyPage(
  spotifyId: SpotifyArtistId,
  offset: number,
  limit: number,
  retries: number,
  maxRetries: number
): Promise<DiscographyPage> {
  const token = await getGuestToken();
  const uri = `spotify:artist:${spotifyId}`;
  const variables = { uri, offset, limit };
  const extensions = {
    persistedQuery: {
      version: 1,
      sha256Hash:
        "b2f27e522e8f4d9c2e3a0f2b79e3e2f68b1b1c3f7a0e9f4e2a7d1b8c5e3f4a1b",
    },
  };

  const params = new URLSearchParams({
    operationName: "queryArtistDiscographyAll",
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
      invalidateGuestToken();
      if (retries < maxRetries) {
        await sleep(1000);
        return fetchDiscographyPage(
          spotifyId,
          offset,
          limit,
          retries + 1,
          maxRetries
        );
      }
      throw new Error(
        `Discography ${spotifyId}: auth failed after token refresh.`
      );
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 30);
      console.warn(
        `[catalog] Rate limited for artist ${spotifyId}. Waiting ${retryAfter}s…`
      );
      await sleep(retryAfter * 1000);
      if (retries < maxRetries) {
        return fetchDiscographyPage(
          spotifyId,
          offset,
          limit,
          retries + 1,
          maxRetries
        );
      }
      throw new Error(
        `Discography ${spotifyId}: rate-limited after max retries.`
      );
    }

    if (response.status >= 500) {
      const backoffMs = Math.pow(2, retries + 1) * 1000;
      await sleep(backoffMs);
      if (retries < maxRetries) {
        return fetchDiscographyPage(
          spotifyId,
          offset,
          limit,
          retries + 1,
          maxRetries
        );
      }
      throw new Error(
        `Discography ${spotifyId}: server error after max retries.`
      );
    }

    if (!response.ok) {
      throw new Error(`Discography ${spotifyId}: HTTP ${response.status}`);
    }

    const json = (await response.json()) as DiscographyResponse;

    if (json.errors && json.errors.length > 0) {
      throw new Error(
        `Discography ${spotifyId} GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`
      );
    }

    const discography = json.data?.artistUnion?.discography?.all;
    if (!discography) {
      return { albums: [], totalCount: 0 };
    }

    const totalCount = discography.totalCount ?? 0;
    const items = discography.items ?? [];

    const albums: AlbumEntry[] = [];
    for (const item of items) {
      const releases = item.releases?.items ?? [];
      for (const rel of releases) {
        if (!rel.id) continue;
        albums.push({
          albumId: toSpotifyAlbumId(rel.id),
          albumName: rel.name ?? "Unknown Album",
          albumType: rel.type ?? "ALBUM",
          releaseDate: rel.date?.isoString ?? "1970-01-01",
          trackCount: rel.tracks?.totalCount ?? 0,
        });
      }
    }

    return { albums, totalCount };
  } catch (err) {
    if (retries < maxRetries && isRetryable(err)) {
      const backoffMs = Math.pow(2, retries + 1) * 1000;
      await sleep(backoffMs);
      return fetchDiscographyPage(
        spotifyId,
        offset,
        limit,
        retries + 1,
        maxRetries
      );
    }
    throw err;
  }
}

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
  if (err instanceof TypeError) return true;
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
