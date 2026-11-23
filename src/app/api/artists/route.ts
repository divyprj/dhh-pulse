import { NextResponse, type NextRequest } from "next/server";
import { getLeaderboard } from "@/lib/analytics/leaderboard";
import type {
  ApiErrorResponse,
  LeaderboardQuery,
  LeaderboardResponse,
  LeaderboardSortKey,
  SnapshotDate,
  SortDirection,
} from "@/types/contracts";
import { PAGINATION_DEFAULTS, isSnapshotDate } from "@/types/contracts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SORT_KEYS: readonly LeaderboardSortKey[] = [
  "totalDailyStreams",
  "monthlyListeners",
  "listenerDelta",
  "followers",
  "topTrackStreams",
];

function parseSortKey(value: string | null): LeaderboardSortKey {
  if (value && (SORT_KEYS as readonly string[]).includes(value)) {
    return value as LeaderboardSortKey;
  }
  return "totalDailyStreams";
}

function parseDirection(value: string | null): SortDirection {
  return value === "asc" ? "asc" : "desc";
}

function parseInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = value === null ? Number.NaN : Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * GET /api/artists
 *
 * Query: sortBy, direction, limit, offset, date (YYYY-MM-DD)
 * Returns: LeaderboardResponse
 *
 * Read-only. The response is never cached — a leaderboard is only true for the
 * snapshot it was generated from.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;

  const dateParam = params.get("date");
  const date =
    dateParam && isSnapshotDate(dateParam) ? (dateParam as SnapshotDate) : undefined;

  const query: LeaderboardQuery = {
    sortBy: parseSortKey(params.get("sortBy")),
    direction: parseDirection(params.get("direction")),
    limit: parseInteger(
      params.get("limit"),
      PAGINATION_DEFAULTS.LEADERBOARD_PAGE_SIZE,
      1,
      PAGINATION_DEFAULTS.MAX_PAGE_SIZE
    ),
    offset: parseInteger(params.get("offset"), 0, 0, 1_000_000),
    ...(date ? { date } : {}),
  };

  try {
    const response: LeaderboardResponse = getLeaderboard(query);
    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Pulse-Sort": `${query.sortBy}:${query.direction}`,
      },
    });
  } catch (error) {
    console.error("[api/artists] leaderboard query failed:", error);
    const body: ApiErrorResponse = {
      error: "Leaderboard query failed. The snapshot store did not answer.",
      code: "LEADERBOARD_QUERY_FAILED",
      statusCode: 500,
    };
    return NextResponse.json(body, {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
