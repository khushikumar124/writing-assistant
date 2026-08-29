import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express, { type Express } from "express";
import { report } from "./_core/observability";
import { mountErrorReporting } from "./_core/observability";
import { createContext } from "./_core/context";
import { mountGoogleAuth } from "./googleAuth";
import { mountCron } from "./cron";
import { mountPublicShelf } from "./publicShelf";
import { appRouter } from "./routers";

/**
 * Builds the Express app, without deciding how it is served.
 *
 * Split out from the dev server so the same app can be a long-running process
 * locally and a serverless handler on Vercel. Nothing in here may assume it
 * runs once at startup — on serverless this executes per cold start, possibly
 * many times a minute.
 */
export function createApp(): Express {
  const app = express();

  // Behind any reverse proxy (Vercel included), the real scheme and client IP
  // arrive in X-Forwarded-*. Without this, cookies never get `Secure` and every
  // visitor shares one rate-limit bucket.
  app.set("trust proxy", 1);

  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  mountErrorReporting(app);

  // Scheduled work, invoked by the platform rather than a timer.
  mountCron(app);

  // Redirect-based sign-in, so it lives outside tRPC.
  mountGoogleAuth(app);

  // Crawler-facing metadata and RSS for public shelves. Must come before any
  // SPA fallback, which would otherwise answer these URLs with the shell.
  mountPublicShelf(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path }) {
        // Only genuine faults: a NOT_FOUND or UNAUTHORIZED is the API working.
        if (error.code === "INTERNAL_SERVER_ERROR") {
          report({
            source: "server",
            message: error.message,
            stack: (error.cause instanceof Error ? error.cause : error).stack,
            at: path ?? "<no path>",
          });
        }
      },
    })
  );

  return app;
}
