/**
 * DHH Pulse — Artist Registry
 *
 * Source-of-truth for all tracked Desi Hip Hop artists.
 * All entries conform to the ArtistRegistryEntry contract.
 *
 * To add an artist: get their Spotify Artist ID from open.spotify.com/artist/<id>
 * and add an entry with active: true.
 */

import type { ArtistRegistryEntry } from "@/types/contracts";
import { toSpotifyArtistId } from "@/types/contracts";

export const DHH_ARTISTS: readonly ArtistRegistryEntry[] = [
  {
    spotifyId: toSpotifyArtistId("5C1S9XwxMuuCciutwMhp5t"),
    name: "KR$NA",
    aliases: ["Krishna Kaul", "KRSNA"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("2oBG74gAocPMFv6Ij9ykdo"),
    name: "Seedhe Maut",
    aliases: ["Calm", "Encore ABJ"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("5uemEEtB1ZC3s1KM7gReeH"),
    name: "MC Stan",
    aliases: ["Altaaf Shaikh"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("4Ai0pGz6GhQavjzaRhPTvz"),
    name: "DIVINE",
    aliases: ["Vivian Fernandes"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("5UdFr0GeO7jKIaNIJgwB36"),
    name: "Raftaar",
    aliases: ["Dilin Nair"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("69xcFpmqTOmFNOL08Bxyci"),
    name: "Talha Anjum",
    aliases: ["Talha"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("3mGW1eoqwNtCxd8R3hIOM5"),
    name: "Talhah Yunus",
    aliases: ["TY"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("2RS1R0tueoL8EJXTSBAt2F"),
    name: "Karma",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("4MJZBb8KABfKw0gzfgacpO"),
    name: "Raga",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("5gzMmZ8RKovEfs38ca7hkG"),
    name: "Bella",
    aliases: ["Bella Bhosle"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("7suHsCqUEifucqVyWaljgC"),
    name: "Prabh Deep",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("0TwG8C39WJIfFlcPrhxHST"),
    name: "Yashraj",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("07iEy1AecUPVzfC2J2gCHR"),
    name: "Ikka",
    aliases: ["Ikka Singh"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("2oeTqp8DgAmtnP2WGc1OS2"),
    name: "Naezy",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("45PG2L6Fh2XvYL4ONzpdoW"),
    name: "Dino James",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("5pqZ05b1zkz3er6iz4d4qr"),
    name: "Muhfaad",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("7ti25GJHIRWZ5f1WN0T2zO"),
    name: "Gravity",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("1GNRmzBPWT8hh6CYxkNiRy"),
    name: "Encore ABJ",
    aliases: ["Abhijay Sharma"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("10qWcrbcxZeuyHHQO1hXxE"),
    name: "Calm",
    aliases: ["Sarthak Mundra"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("0y59o4v8uw5crbN9M3JiL1"),
    name: "Badshah",
    aliases: ["Aditya Prateek Singh Sisodia"],
    active: true,
    addedAt: "2024-01-01",
  },
] as const;

/**
 * Returns all active artists in the registry.
 */
export function getActiveArtists(): readonly ArtistRegistryEntry[] {
  return DHH_ARTISTS.filter((a) => a.active);
}

/**
 * Finds an artist by Spotify ID.
 */
export function findArtistById(
  spotifyId: string
): ArtistRegistryEntry | undefined {
  return DHH_ARTISTS.find((a) => a.spotifyId === spotifyId);
}
