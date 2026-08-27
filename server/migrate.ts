import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import { ENV } from "./_core/env";
import { getDb, getRawDb } from "./db";

/**
 * Applies any pending migrations.
 *
 * Called on every boot rather than as a separate deploy step: this app runs as
 * a single node against one SQLite file, so there is no window where old and
 * new code touch the database at once, and "deploy" should not mean "remember
 * to also run the migration".
 */

/**
 * The folder sits at `<root>/drizzle/migrations` in the repo, but the server is
 * bundled to `<root>/dist/index.js` in production, so the relative path differs
 * between the two. Rather than guess, look in both.
 */
function resolveMigrationsFolder(): string {
  const candidates = [
    path.resolve(import.meta.dirname, "../drizzle/migrations"),
    path.resolve(import.meta.dirname, "../../drizzle/migrations"),
    path.resolve(process.cwd(), "drizzle/migrations"),
  ];

  const found = candidates.find(candidate => fs.existsSync(candidate));
  if (!found) {
    throw new Error(
      `Could not find drizzle/migrations. Looked in:\n  ${candidates.join("\n  ")}`
    );
  }
  return found;
}

export async function migrateToLatest(): Promise<void> {
  const migrationsFolder = resolveMigrationsFolder();
  const raw = getRawDb();

  /**
   * Foreign keys MUST be off while migrating, and it has to happen here rather
   * than in the .sql file.
   *
   * SQLite cannot ALTER a column's nullability, so drizzle-kit rewrites the
   * whole table: create `__new_users`, copy rows across, `DROP TABLE users`,
   * rename. Every table referencing `users` does so with ON DELETE CASCADE, so
   * if enforcement is on when that DROP runs, SQLite cascades it and deletes
   * every idea, thought and draft in the database.
   *
   * The generated migration does emit `PRAGMA foreign_keys=OFF`, but SQLite
   * silently ignores that pragma inside a transaction — and the migrator wraps
   * everything in one. Setting it out here, before the transaction opens, is
   * the only thing that actually takes effect.
   */
  raw.pragma("foreign_keys = OFF");
  try {
    migrate(getDb(), { migrationsFolder });
  } finally {
    raw.pragma("foreign_keys = ON");
  }

  // Re-check the graph after a rewrite, so a broken reference surfaces at boot
  // rather than as a mystery months later.
  const violations = raw.pragma("foreign_key_check") as unknown[];
  if (violations.length > 0) {
    throw new Error(
      `Migration left ${violations.length} foreign key violation(s); refusing to start.`
    );
  }

  console.log(`[db] schema up to date (${path.resolve(ENV.databaseFile)})`);
}
