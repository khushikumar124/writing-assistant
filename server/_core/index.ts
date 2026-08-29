import "dotenv/config";
import { createServer } from "node:http";
import { createApp } from "../app";
import { purgeExpiredDemoUsers, purgeExpiredTrash } from "../db";
import { scheduleReminders } from "../reminders";
import { ENV } from "./env";
import { installProcessHandlers } from "./observability";
import { serveStatic, setupVite } from "./vite";

/**
 * The long-running server: local development, and any self-hosted deploy.
 *
 * Vercel does not use this file — it imports the same app from `api/index.ts`.
 * The difference is what wraps the app: here it listens on a port and runs its
 * own timers, there the platform provides both.
 */

/** Housekeeping that serverless gets from a scheduled request instead. */
async function sweep() {
  try {
    const [sandboxes, trashed] = await Promise.all([
      purgeExpiredDemoUsers(),
      purgeExpiredTrash(),
    ]);
    if (sandboxes > 0 || trashed > 0) {
      console.log(
        `[sweep] purged ${sandboxes} expired sandbox(es), ${trashed} trashed row(s)`
      );
    }
  } catch (error) {
    // Housekeeping must never stop the server from coming up.
    console.error("[sweep] failed:", error);
  }
}

async function startServer() {
  installProcessHandlers();

  const app = createApp();
  const server = createServer(app);

  if (ENV.isProduction) {
    serveStatic(app);
  } else {
    await setupVite(app, server);
  }

  server.listen(ENV.port, () => {
    console.log(`\n  Writing Assistant → http://localhost:${ENV.port}\n`);
    void sweep();
    scheduleReminders();
  });
}

startServer().catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
