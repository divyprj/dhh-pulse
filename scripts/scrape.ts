#!/usr/bin/env node
/**
 * DHH Pulse — Standalone Scrape CLI Entry Point
 *
 * Usage:
 *   npx tsx scripts/scrape.ts                # Full catalog sync for all artists
 *   npx tsx scripts/scrape.ts --quick        # Quick update (no catalog discovery)
 *   npx tsx scripts/scrape.ts --artist <id>  # Single artist by Spotify ID
 *
 * This script is designed to run standalone (outside Next.js) using tsx.
 * It connects to the SQLite database and runs the batch orchestrator.
 */

import { parseArgs } from "util";
import { getActiveArtists, findArtistById } from "@/config/artists";
import { runBatchScrape } from "@/lib/scraper/orchestrator";
import { closeDb } from "@/lib/db/client";
import { DEFAULT_SCRAPER_CONFIG } from "@/types/contracts";
import type { ArtistRegistryEntry } from "@/types/contracts";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const { values: args } = parseArgs({
  args: process.argv.slice(2),
  options: {
    quick: { type: "boolean", default: false },
    artist: { type: "string", default: undefined },
    delay: { type: "string", default: undefined },
    help: { type: "boolean", default: false, short: "h" },
  },
  allowPositionals: false,
});

if (args.help) {
  console.log(`
DHH Pulse — Spotify Data Scraper
=================================
Usage:
  npx tsx scripts/scrape.ts                  Full catalog sync, all active artists
  npx tsx scripts/scrape.ts --quick          Quick update only (no catalog discovery)
  npx tsx scripts/scrape.ts --artist <id>   Scrape single artist by Spotify Artist ID
  npx tsx scripts/scrape.ts --delay <ms>    Override base delay between requests (ms)
  npx tsx scripts/scrape.ts --help          Show this help message

Examples:
  npx tsx scripts/scrape.ts --artist 4YRxDV8wJFPHPTeXepOstw
  npx tsx scripts/scrape.ts --quick --delay 3000
`);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Resolve artist list
// ---------------------------------------------------------------------------

let artistsToScrape: readonly ArtistRegistryEntry[];

if (args.artist) {
  const found = findArtistById(args.artist);
  if (!found) {
    console.error(
      `[scrape] Error: Artist ID "${args.artist}" not found in registry.`
    );
    console.error(
      `[scrape] Add it to src/config/artists.ts first.`
    );
    process.exit(1);
  }
  artistsToScrape = [found];
  console.log(`[scrape] Single-artist mode: ${found.name} (${found.spotifyId})`);
} else {
  artistsToScrape = getActiveArtists();
  console.log(`[scrape] Batch mode: ${artistsToScrape.length} active artists`);
}

// ---------------------------------------------------------------------------
// Build scraper config
// ---------------------------------------------------------------------------

const scraperConfig = {
  ...DEFAULT_SCRAPER_CONFIG,
  ...(args.delay
    ? { baseDelayMs: parseInt(args.delay, 10) }
    : {}),
};

const fullCatalogSync = !args.quick;

console.log(
  `[scrape] Mode: ${fullCatalogSync ? "Full Catalog Sync" : "Quick Update"}`
);

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  try {
    const result = await runBatchScrape(
      artistsToScrape,
      scraperConfig,
      fullCatalogSync
    );

    // Summary
    const durationSec = Math.round((result.completedAt - result.startedAt) / 1000);
    console.log("\n════════════════════════════════════════");
    console.log("SCRAPE COMPLETE");
    console.log("════════════════════════════════════════");
    console.log(`Total artists  : ${result.totalArtists}`);
    console.log(`Successful     : ${result.successCount}`);
    console.log(`Failed         : ${result.failureCount}`);
    console.log(`Duration       : ${durationSec}s`);

    if (result.failureCount > 0) {
      console.log("\nFailed artists:");
      for (const r of result.results) {
        if (!r.success) {
          console.log(`  - ${r.artist.name}: ${r.error}`);
        }
      }
    }

    // Exit with error code if all artists failed
    if (result.failureCount === result.totalArtists) {
      console.error("[scrape] All artists failed. Check network and token.");
      process.exit(1);
    }

    console.log("\n[scrape] Data written to data/dhh-pulse.sqlite");
  } catch (err) {
    console.error(
      "[scrape] Fatal error:",
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  } finally {
    closeDb();
  }
}

main();
