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

export const ENV = {
  isProduction,
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
  /** Path to the SQLite database file, relative to the project root. */
  databaseFile: process.env.DATABASE_URL ?? "./data/app.db",
  sessionSecret: resolveSessionSecret(),
  /**
   * Enables the "Try it without an account" button. Each click mints a private,
   * throwaway sandbox account — there is no shared demo login to hijack.
   */
  demoMode: process.env.DEMO_MODE !== "false",
  /** Absolute base URL, used to build links inside emails. */
  appUrl: (
    process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? "3000"}`
  ).replace(/\/$/, ""),
  /** Optional. Without it, outbound mail is logged to the console instead. */
  resendApiKey: process.env.RESEND_API_KEY?.trim() || null,
  /**
   * Google sign-in turns itself on only when both halves are present, so a
   * deploy without them simply shows email/password and nothing breaks.
   */
  googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || null,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || null,
  mailFrom:
    process.env.MAIL_FROM ?? "Writing Assistant <onboarding@resend.dev>",
} as const;

/** True when both Google credentials are configured. */
export const googleEnabled = (): boolean =>
  Boolean(ENV.googleClientId && ENV.googleClientSecret);

/** How long a sandbox account lives before it is purged, along with its writing. */
export const DEMO_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours

/** Password reset links are short-lived by design. */
export const PASSWORD_RESET_TTL_MS = 1000 * 60 * 60; // 1 hour

/** Soft-deleted rows are purged for good after this long in the bin. */
export const TRASH_RETENTION_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
