/**
 * DHH Pulse — Spotify Pathfinder Track Playcount Scraper
 *
 * Extracts exact track playcounts from Spotify's internal Pathfinder GraphQL API.
 * The official Spotify Web API does NOT expose playcounts; this scraper uses the
 * same internal endpoint used by the Spotify web player.
 *
 * GraphQL operation: getTrack (by album with tracks)
 */

import type {
  ScrapedTrackData,
  SpotifyAlbumId,
  SpotifyArtistId,
  SpotifyTrackId,
} from "@/types/contracts";
import {
  SPOTIFY_ENDPOINTS,
  toSpotifyAlbumId,
  toSpotifyArtistId,
  toSpotifyTrackId,
} from "@/types/contracts";
import { getGuestToken, invalidateGuestToken } from "./auth";

// ---------------------------------------------------------------------------
// GraphQL query for album tracks with playcounts
// ---------------------------------------------------------------------------
const ALBUM_TRACKS_QUERY = `
  query getAlbum(
    $uri: ID!
    $locale: String
    $offset: Int!
    $limit: Int!
  ) {
    albumUnion(uri: $uri) {
      __typename
      ... on Album {
        uri
        name
        date {
          isoString
        }
        tracks(offset: $offset, limit: $limit) {
          totalCount
          items {
            uid
            track {
              ... on Track {
                id
                uri
                name
                discNumber
                trackNumber
                duration {
                  totalMilliseconds
                }
                contentRating {
                  label
                }
                playcount
                artists {
                  items {
                    id
                    uri
                    profile {
                      name
                    }
                  }
                }
                albumOfTrack {
                  id
                  uri
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Raw shapes
interface AlbumTracksResponse {
  data?: {
    albumUnion?: {
      __typename: string;
      uri?: string;
      name?: string;
      date?: { isoString?: string };
      tracks?: {
        totalCount?: number;
        items?: Array<{
          uid?: string;
          track?: {
            id?: string;
            uri?: string;
            name?: string;
            discNumber?: number;
            trackNumber?: number;
            duration?: { totalMilliseconds?: number };
            contentRating?: { label?: string };
            playcount?: string; // Spotify returns playcount as string
            artists?: {
              items?: Array<{
                id?: string;
                profile?: { name?: string };
              }>;
            };
            albumOfTrack?: { id?: string; name?: string };
          };
        }>;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

/**
 * Fetches all tracks (with playcounts) for a given Spotify album.
 * Handles pagination if the album has >50 tracks.
 *
 * @param albumId       Spotify album ID
 * @param albumName     Album display name (passed through for efficiency)
 * @param releaseDate   Album release date ISO string
 * @param retries       Internal retry counter
 */
export async function fetchAlbumTracks(
  albumId: SpotifyAlbumId,
  albumName: string,
  releaseDate: string,
  retries = 0
): Promise<ScrapedTrackData[]> {
  const maxRetries = 3;
  const pageSize = 50;
  const allTracks: ScrapedTrackData[] = [];

  let offset = 0;
  let totalCount = Infinity;

  while (offset < totalCount) {
    const batch = await fetchAlbumTrackPage(
      albumId,
      albumName,
      releaseDate,
      offset,
      pageSize,
      retries,
      maxRetries
    );

    allTracks.push(...batch.tracks);
    totalCount = batch.totalCount;
    offset += pageSize;

    // No more tracks
    if (batch.tracks.length === 0) break;
  }

  return allTracks;
}

interface AlbumTrackPage {
  tracks: ScrapedTrackData[];
  totalCount: number;
}

async function fetchAlbumTrackPage(
  albumId: SpotifyAlbumId,
  albumName: string,
  releaseDate: string,
  offset: number,
  limit: number,
  retries: number,
  maxRetries: number
): Promise<AlbumTrackPage> {
  const token = await getGuestToken();
  const uri = `spotify:album:${albumId}`;
  const variables = { uri, locale: "", offset, limit };
  const extensions = {
    persistedQuery: {
      version: 1,
      sha256Hash:
        "469874edcad37b7a379d4f22f0083a49ea3d6ae097916120d9efa04abb1dd21e",
    },
  };

  const params = new URLSearchParams({
    operationName: "getAlbum",
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
        return fetchAlbumTrackPage(
          albumId,
          albumName,
          releaseDate,
          offset,
          limit,
          retries + 1,
          maxRetries
        );
      }
      throw new Error(`Album ${albumId}: auth failed after token refresh.`);
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 30);
      console.warn(
        `[tracks] Rate limited for album ${albumId}. Waiting ${retryAfter}s…`
      );
      await sleep(retryAfter * 1000);
      if (retries < maxRetries) {
        return fetchAlbumTrackPage(
          albumId,
          albumName,
          releaseDate,
          offset,
          limit,
          retries + 1,
          maxRetries
        );
      }
      throw new Error(`Album ${albumId}: rate-limited after max retries.`);
    }

    if (response.status >= 500) {
      const backoffMs = Math.pow(2, retries + 1) * 1000;
      await sleep(backoffMs);
      if (retries < maxRetries) {
        return fetchAlbumTrackPage(
          albumId,
          albumName,
          releaseDate,
          offset,
          limit,
          retries + 1,
          maxRetries
        );
      }
      throw new Error(`Album ${albumId}: server error after max retries.`);
    }

    if (!response.ok) {
      throw new Error(`Album ${albumId}: HTTP ${response.status}`);
    }

    const json = (await response.json()) as AlbumTracksResponse;

    if (json.errors && json.errors.length > 0) {
      throw new Error(
        `Album ${albumId} GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`
      );
    }

    const album = json.data?.albumUnion;
    if (!album || album.__typename !== "Album") {
      return { tracks: [], totalCount: 0 };
    }

    const totalCount = album.tracks?.totalCount ?? 0;
    const items = album.tracks?.items ?? [];

    const tracks: ScrapedTrackData[] = items
      .filter((item) => item.track?.id)
      .map((item) => {
        const t = item.track!;
        const artistItems = t.artists?.items ?? [];

        return {
          trackId: toSpotifyTrackId(t.id ?? ""),
          name: t.name ?? "Unknown Track",
          artistIds: artistItems
            .filter((a) => a.id)
            .map((a) => toSpotifyArtistId(a.id!)),
          artistNames: artistItems
            .filter((a) => a.profile?.name)
            .map((a) => a.profile!.name!),
          albumId: toSpotifyAlbumId(albumId),
          albumName: albumName,
          durationMs: t.duration?.totalMilliseconds ?? 0,
          playcount: parseInt(t.playcount ?? "0", 10) || 0,
          discNumber: t.discNumber ?? 1,
          trackNumber: t.trackNumber ?? 1,
          releaseDate: releaseDate,
          isExplicit:
            t.contentRating?.label?.toUpperCase() === "EXPLICIT",
        } satisfies ScrapedTrackData;
      });

    return { tracks, totalCount };
  } catch (err) {
    if (retries < maxRetries && isRetryable(err)) {
      const backoffMs = Math.pow(2, retries + 1) * 1000;
      await sleep(backoffMs);
      return fetchAlbumTrackPage(
        albumId,
        albumName,
        releaseDate,
        offset,
        limit,
        retries + 1,
        maxRetries
      );
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
