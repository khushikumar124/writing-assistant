import type { Express, Request, Response } from "express";
import { ENV } from "./env";

/**
 * Knowing when something breaks.
 *
 * Without this, a user hitting a bug is a silent event: they see a broken
 * screen, close the tab, and nobody ever finds out. That is the single worst
 * failure mode for a small app, because the first symptom is people quietly
 * not coming back.
 *
 * Errors are written to stderr as one JSON object per line, which is what the
 * host's log viewer (`fly logs`) already collects and greps. No third-party
 * account is required to get value from this. If a `SENTRY_DSN` is configured
 * later, forwarding these same records is a small change in `report` below.
 */

export type ErrorSource = "server" | "client";

export type ErrorRecord = {
  source: ErrorSource;
  message: string;
  stack?: string;
  /** Where it happened: a tRPC path, or a browser URL. */
  at?: string;
  userId?: number | null;
  userAgent?: string;
};

/** Bounds what a hostile client can write into the logs. */
function clamp(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

export function report(record: ErrorRecord): void {
  // One line, structured, so it greps and parses. Timestamped by the host.
  console.error(
    JSON.stringify({
      level: "error",
      ts: new Date().toISOString(),
      ...record,
    })
  );
}

/**
 * Client-side error sink.
 *
 * Deliberately unauthenticated: the errors most worth seeing are the ones that
 * break the page before a session is established. That means it is an open
 * write endpoint, so everything is length-capped and rate limited, and it
 * stores nothing — it only writes to the log stream.
 */
export function mountErrorReporting(app: Express): void {
  const seen = new Map<string, number>();
  const WINDOW_MS = 60_000;
  const MAX_PER_WINDOW = 20;

  app.post("/api/errors", (req: Request, res: Response) => {
    const ip = req.ip ?? "unknown";
    const now = Date.now();

    // Cheap fixed window, separate from the auth limiter: a broken deploy can
    // produce thousands of identical reports in seconds and must not drown the
    // logs or the event loop.
    const count = (seen.get(ip) ?? 0) + 1;
    seen.set(ip, count);
    if (seen.size > 2_000) seen.clear();
    setTimeout(() => seen.delete(ip), WINDOW_MS).unref?.();

    if (count > MAX_PER_WINDOW) {
      res.status(429).end();
      return;
    }

    const body = req.body ?? {};
    report({
      source: "client",
      message: clamp(body.message, 500) ?? "Unknown client error",
      stack: clamp(body.stack, 4_000),
      at: clamp(body.at, 500),
      userAgent: clamp(req.headers["user-agent"], 300),
    });

    // 204: the browser does not care, and there is nothing useful to say.
    res.status(204).end();
  });

  if (!ENV.isProduction) {
    console.log("  Error reporting → POST /api/errors (logged to stderr)");
  }
}

/**
 * Last-resort handlers. A crashed process on a single-machine deploy is total
 * downtime, so an unhandled rejection should be loud rather than fatal.
 */
export function installProcessHandlers(): void {
  process.on("unhandledRejection", reason => {
    report({
      source: "server",
      message: `Unhandled rejection: ${String(reason)}`,
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });

  process.on("uncaughtException", error => {
    report({
      source: "server",
      message: `Uncaught exception: ${error.message}`,
      stack: error.stack,
    });
    // An uncaught exception leaves the process in an unknown state. Exit and
    // let the platform restart it, rather than serving from a broken one.
    process.exit(1);
  });
}
