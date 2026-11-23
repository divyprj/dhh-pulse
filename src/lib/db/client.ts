/**
 * DHH Pulse — SQLite Database Client Singleton
 *
 * Uses better-sqlite3 with WAL mode for high-throughput reads.
 * The singleton ensures only one connection exists per process.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { createSchema } from "./schema";

const DB_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "dhh-pulse.sqlite");

let _db: Database.Database | null = null;

/**
 * Returns the singleton better-sqlite3 Database instance.
 * Creates the database file and runs schema migrations on first call.
 */
export function getDb(): Database.Database {
  if (_db) return _db;

  // Ensure the data directory exists
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH, {
    // Verbose logging in development
    verbose: process.env.NODE_ENV === "development"
      ? (msg) => process.stdout.write(`[sqlite] ${msg}\n`)
      : undefined,
  });

  // Apply schema (idempotent)
  createSchema(_db);

  return _db;
}

/**
 * Closes the database connection and resets the singleton.
 * Useful for graceful shutdown in CLI scripts.
 */
export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * Convenience export — the db singleton.
 * NOTE: Lazy — does not connect until first access.
 */
export const db = {
  get instance(): Database.Database {
    return getDb();
  },
  close: closeDb,
};

export default db;
