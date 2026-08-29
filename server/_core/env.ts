import crypto from "node:crypto";

const isProduction = process.env.NODE_ENV === "production";

/**
 * In development we fall back to an ephemeral secret so the app runs with zero
 * configuration — the cost is that sessions don't survive a restart. In
 * production an explicit secret is mandatory: a random one would silently log
 * every user out on each deploy.
 */
function resolveSessionSecret(): string {
  const configured = process.env.SESSION_SECRET?.trim();
  if (configured) return configured;

  if (isProduction) {
    throw new Error(
      "SESSION_SECRET is required in production. Generate one with: openssl rand -base64 32"
    );
  }

  console.warn(
    "[env] SESSION_SECRET not set — using a random development secret. Sessions will not survive a restart."
  );
  return crypto.randomBytes(32).toString("base64");
}

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Create a free Postgres database at neon.com and put its pooled connection string in .env"
    );
  }
  return url;
}

export const ENV = {
  isProduction,
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
  /**
   * Postgres connection string. Required everywhere — there is no local file
   * fallback, because silently writing to a different database than production
   * is a worse failure than refusing to start.
   */
  databaseUrl: resolveDatabaseUrl(),
  sessionSecret: resolveSessionSecret(),
  /**
   * Enables the "Try it without an account" button. Each click mints a private,
   * throwaway sandbox account — there is no shared demo login to hijack.
   */
  demoMode: process.env.DEMO_MODE !== "false",
  /** Absolute base URL. Used to build the OAuth redirect URI. */
  appUrl: (
    process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? "3000"}`
  ).replace(/\/$/, ""),
  /**
   * Google sign-in turns itself on only when both halves are present, so a
   * deploy without them simply shows email/password and nothing breaks.
   */
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || null,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || null,
  /**
   * Web Push signing keys. Generate a pair with `npm run keys:vapid`. Without
   * them the reminder settings hide themselves and nothing is scheduled.
   */
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY?.trim() || null,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY?.trim() || null,
  /** Contact address push services can use to reach the operator. */
  vapidSubject: process.env.VAPID_SUBJECT?.trim() || "mailto:hello@example.com",
  /**
   * Shared secret the platform's scheduler presents when calling /api/cron/*.
   * Vercel sets this header automatically when the variable is configured.
   */
  cronSecret: process.env.CRON_SECRET?.trim() || null,
} as const;

/** True when both Google credentials are configured. */
export const googleEnabled = (): boolean =>
  Boolean(ENV.googleClientId && ENV.googleClientSecret);

/** How long a sandbox account lives before it is purged, along with its writing. */
export const DEMO_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

/** Soft-deleted rows are purged for good after this long in the bin. */
export const TRASH_RETENTION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
