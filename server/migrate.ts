import { migrate } from "drizzle-orm/postgres-js/migrator";
import fs from "node:fs";
import path from "node:path";
import { getClient, getDb } from "./db";

/**
 * Applies pending migrations.
 *
 * Run as a deploy step rather than at boot: on serverless there is no single
 * "start", every request may cold-start its own process, and having dozens of
 * them race to migrate the same database is a good way to corrupt it. Postgres
 * would serialise them on a lock, but the right answer is to migrate once,
 * deliberately, before the new code serves traffic.
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
  await migrate(getDb(), { migrationsFolder: resolveMigrationsFolder() });
  console.log("[db] schema up to date");
}

/** Closes the pool so a one-shot migration script can exit. */
export async function closeDb(): Promise<void> {
  await getClient().end();
}
