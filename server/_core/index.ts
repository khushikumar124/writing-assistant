import "dotenv/config";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { createServer } from "node:http";
import { purgeExpiredDemoUsers, purgeExpiredTrash } from "../db";
import { mountGoogleAuth } from "../googleAuth";
import { migrateToLatest } from "../migrate";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { serveStatic, setupVite } from "./vite";

/**
 * Housekeeping that would otherwise need a cron: expired sandbox accounts and
 * long-abandoned trash. Cheap enough to run on every boot, and a single-node
 * app restarts often enough for that to be sufficient.
 */
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
  // Schema first: the app should never serve a request against a database it
  // has outgrown, and a single-node deploy has no window to run this by hand.
  await migrateToLatest();

  const app = express();
  const server = createServer(app);

  // Behind Fly/Railway/a reverse proxy, the real scheme and client IP arrive in
  // X-Forwarded-*. Without this, cookies never get `Secure` and every visitor
  // shares one rate-limit bucket.
  app.set("trust proxy", 1);

  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));

  // Plain HTTP health check for container/platform probes, which generally
  // can't speak tRPC.
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Redirect-based sign-in, so it lives outside tRPC.
  mountGoogleAuth(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path }) {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          console.error(`[trpc] ${path ?? "<no path>"}:`, error.cause ?? error);
        }
      },
    })
  );

  if (ENV.isProduction) {
    serveStatic(app);
  } else {
    await setupVite(app, server);
  }

  server.listen(ENV.port, () => {
    console.log(`\n  Writing Assistant → http://localhost:${ENV.port}\n`);
    void sweep();
  });
}

startServer().catch(error => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
