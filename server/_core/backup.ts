import fs from "node:fs";
import path from "node:path";
import { ENV } from "./env";
import { getRawDb } from "../db";
import { report } from "./observability";

/**
 * Automatic local backups.
 *
 * The deploy guide tells you to take a backup before every migration, which
 * means it will not happen — a manual step in a checklist is a step that gets
 * skipped on the day it matters. This takes one on a timer instead.
 *
 * `db.backup()` uses SQLite's online backup API, so it produces a consistent
 * snapshot of a live database including anything still sitting in the WAL. A
 * plain file copy does not, which is the usual way people end up with a backup
 * that restores to a half-written database.
 *
 * These live on the same volume, so they protect against the likely disasters —
 * a bad migration, a delete gone wrong, a corrupted table — and not against
 * losing the volume itself. Pulling one off the machine periodically is still
 * worth doing; see DEPLOY.md.
 */

const INTERVAL_MS = 24 * 60 * 60 * 1000;
const KEEP = 7;

function backupDir(): string {
  return path.join(path.dirname(path.resolve(ENV.databaseFile)), "backups");
}

export async function takeBackup(): Promise<string> {
  const dir = backupDir();
  fs.mkdirSync(dir, { recursive: true });

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const destination = path.join(dir, `app-${stamp}.db`);

  await getRawDb().backup(destination);
  prune(dir);

  return destination;
}

/** Keeps the newest `KEEP` snapshots so the volume can't fill with history. */
function prune(dir: string): void {
  const snapshots = fs
    .readdirSync(dir)
    .filter(name => name.startsWith("app-") && name.endsWith(".db"))
    .sort()
    .reverse();

  for (const stale of snapshots.slice(KEEP)) {
    fs.rmSync(path.join(dir, stale), { force: true });
  }
}

/**
 * Runs one immediately (so a fresh deploy has a restore point before anyone
 * touches it) and then daily.
 */
export function scheduleBackups(): void {
  const run = async () => {
    try {
      const file = await takeBackup();
      console.log(`[backup] wrote ${file}`);
    } catch (error) {
      // A failed backup must never take the app down, but it must be visible.
      report({
        source: "server",
        message: `Backup failed: ${error instanceof Error ? error.message : String(error)}`,
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  };

  void run();
  // `unref` so a pending timer never holds the process open during a shutdown.
  setInterval(run, INTERVAL_MS).unref?.();
}
