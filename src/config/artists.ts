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
    spotifyId: toSpotifyArtistId("4YRxDV8wJFPHPTeXepOstw"),
    name: "KR$NA",
    aliases: ["Krishna Kaul", "KRSNA"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("4oBPFkL2bcoSHbhKKKhXWW"),
    name: "Seedhe Maut",
    aliases: ["Calm", "Encore ABJ"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("7qQJQ3YtcGlqaLg5lcryGW"),
    name: "MC Stan",
    aliases: ["Altaaf Shaikh"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("2cGwlqi3k18jFpUyTrsR84"),
    name: "DIVINE",
    aliases: ["Vivian Fernandes"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("1Cd373x9ghsI9De6mXMsIq"),
    name: "Raftaar",
    aliases: ["Dilin Nair"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("2QYsYWEBfRZTuSmPM9CJRC"),
    name: "Talha Anjum",
    aliases: ["Talha"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("4oLeXFyACqeem2VImYeBFe"),
    name: "Talhah Yunus",
    aliases: ["TY"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("2w9zwq3AkvW0NFy2BdRCMl"),
    name: "Karma",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("1oWmOuJN14h2eKJiEIFwPT"),
    name: "Raga",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("3nxMFjlCFiHyGXjAZCMvzP"),
    name: "Bella",
    aliases: ["Bella Bhosle"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("5f4QpKfy7ptCHwTqspnSJI"),
    name: "Prabh Deep",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("4iWoVMEBhSEBvHDPESwzaZ"),
    name: "Yashraj",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("2cQkGPFJuRGQtnIfQhfIBI"),
    name: "Ikka",
    aliases: ["Ikka Singh"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("7Ds70nSQ6STGNaYLBaFoTd"),
    name: "Naezy",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("7GBkBHlMFPnLhHF3Hd1gon"),
    name: "Dino James",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("2NoPAIH97PAmNFiHGnxGhV"),
    name: "Muhfaad",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("7c0XG5cIJTrrAgEC3ULGEo"),
    name: "Gravity",
    aliases: [],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("4ND48Yn62b59Fn2QHJCBpN"),
    name: "Encore ABJ",
    aliases: ["Abhijay Sharma"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("4jOcoMPvNrSXUGCVKgJIyT"),
    name: "Calm",
    aliases: ["Sarthak Mundra"],
    active: true,
    addedAt: "2024-01-01",
  },
  {
    spotifyId: toSpotifyArtistId("4OrizGCKhOrW6iDGUGToNY"),
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
