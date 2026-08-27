import { TRPCError } from "@trpc/server";
import type { Request } from "express";

/**
 * A fixed-window rate limiter held in process memory.
 *
 * This is deliberately not Redis. The app runs as a single node against a local
 * SQLite file, so a shared store would add a dependency without buying
 * anything; if this ever runs multi-node, this file is the one place to swap.
 * The trade-off is that a restart forgives everyone, which is acceptable for
 * throttling password guesses but would not be for billing.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/** Stops the map growing without bound on a long-running process. */
function sweep(now: number): void {
  if (windows.size < 5_000) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type RateLimitRule = {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
};

export const AUTH_LIMITS = {
  /** Sign-in: generous enough for a fat-fingered password, tight enough to stop guessing. */
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  /** Account creation, to slow down bulk signup. */
  signup: { limit: 5, windowMs: 60 * 60 * 1000 },
  /** Reset emails, so the endpoint can't be used to spam someone's inbox. */
  passwordReset: { limit: 4, windowMs: 60 * 60 * 1000 },
  /** Demo sandboxes, which cost a database write and a seed each. */
  demo: { limit: 6, windowMs: 60 * 60 * 1000 },
} as const satisfies Record<string, RateLimitRule>;

/**
 * The client's address, trusting `X-Forwarded-For` only for its first entry —
 * later entries can be forged by the client itself.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const first = raw.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

/**
 * Consumes one unit against `key`. Throws TOO_MANY_REQUESTS once the window is
 * spent, with a message telling the user how long to wait.
 */
export function consume(key: string, rule: RateLimitRule): void {
  const now = Date.now();
  sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + rule.windowMs });
    return;
  }

  existing.count += 1;
  if (existing.count > rule.limit) {
    const minutes = Math.max(1, Math.ceil((existing.resetAt - now) / 60_000));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
    });
  }
}

/** Clears all windows. Test-only. */
export function resetAllLimits(): void {
  windows.clear();
}
