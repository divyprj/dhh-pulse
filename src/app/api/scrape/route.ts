import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { DHH_ARTISTS } from "@/config/artists";
import { runBatchScrape } from "@/lib/scraper/orchestrator";
import type {
  ApiErrorResponse,
  ArtistRegistryEntry,
  ScrapeResponse,
  SpotifyArtistId,
} from "@/types/contracts";
import {
  DEFAULT_SCRAPER_CONFIG,
  toSpotifyArtistId,
} from "@/types/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** A full sequential pass across the registry can run for several minutes. */
export const maxDuration = 300;

/** Process-local circuit breaker — one scrape pass at a time. */
let syncInFlight = false;

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Trigger authorization.
 *
 * When `SCRAPE_TRIGGER_TOKEN` is configured the route requires a matching
 * `x-scrape-token` header (or `Authorization: Bearer …`). Unset — the default
 * for a self-hosted, single-operator install — the route is open on the same
 * origin as the console.
 */
function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.SCRAPE_TRIGGER_TOKEN;
  if (!expected) return true;

  const headerToken = request.headers.get("x-scrape-token");
  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const presented = headerToken ?? bearer ?? "";

  return presented.length > 0 && safeEqual(presented, expected);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorBody(): ApiErrorResponse {
  return {
    error: "A sync is already running. Wait for the current pass to finish.",
    code: "SCRAPE_ALREADY_RUNNING",
    statusCode: 409,
  };
}

/**
 * POST /api/scrape
 *
 * Body: ScrapeRequest — `{ artistIds?: string[], fullCatalogSync: boolean }`
 * Returns: ScrapeResponse
 *
 * The batch is detached: the route answers immediately with `started` while the
 * orchestrator writes snapshots artist-by-artist. Designed for a long-lived
 * `next start` process, not a frozen serverless invocation.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) {
    const body: ApiErrorResponse = {
      error: "Missing or invalid scrape trigger token.",
      code: "SCRAPE_UNAUTHORIZED",
      statusCode: 401,
    };
    return NextResponse.json(body, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (syncInFlight) {
    const body = errorBody();
    const payload: ScrapeResponse = { status: "already_running", message: body.error };
    return NextResponse.json(payload, {
      status: 409,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let raw: unknown = null;
  try {
    raw = await request.json();
  } catch {
    raw = null;
  }

  const fullCatalogSync =
    isRecord(raw) && typeof raw.fullCatalogSync === "boolean"
      ? raw.fullCatalogSync
      : true;

  const requestedIds =
    isRecord(raw) && Array.isArray(raw.artistIds)
      ? raw.artistIds.filter((id): id is string => typeof id === "string")
      : [];

  const requestedSet = new Set<SpotifyArtistId>(
    requestedIds.map((id) => toSpotifyArtistId(id))
  );

  let artists: ArtistRegistryEntry[] = DHH_ARTISTS.filter((artist) => artist.active);
  if (requestedSet.size > 0) {
    artists = artists.filter((artist) => requestedSet.has(artist.spotifyId));
  }

  if (artists.length === 0) {
    const payload: ScrapeResponse = {
      status: "error",
      message: "No active artists matched this request.",
    };
    return NextResponse.json(payload, {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  }

  syncInFlight = true;

  void runBatchScrape(artists, DEFAULT_SCRAPER_CONFIG, fullCatalogSync)
    .then((result) => {
      console.log(
        `[api/scrape] batch complete — ${result.successCount}/${result.totalArtists} artists, ${result.failureCount} failed`
      );
    })
    .catch((error: unknown) => {
      console.error("[api/scrape] batch failed:", error);
    })
    .finally(() => {
      syncInFlight = false;
    });

  const payload: ScrapeResponse = {
    status: "started",
    message: `Sync queued for ${artists.length} artist${artists.length === 1 ? "" : "s"}${
      fullCatalogSync ? " (full catalog)" : " (known tracks only)"
    }. Snapshots land artist by artist.`,
  };

  return NextResponse.json(payload, {
    status: 202,
    headers: { "Cache-Control": "no-store" },
  });
}
