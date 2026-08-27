import type { Express, Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { createSessionToken, setSessionCookie } from "./_core/auth";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV, googleEnabled } from "./_core/env";
import { buildGoogleAuthUrl, exchangeGoogleCode } from "./_core/oauth";
import { AUTH_LIMITS, clientIp, consume } from "./_core/rateLimit";
import {
  createCategory,
  createGoogleUser,
  findUserByEmail,
  findUserByGoogleId,
  getPreferences,
  linkGoogleId,
  touchLastSignedIn,
} from "./db";

/**
 * The Google sign-in endpoints.
 *
 * These are plain Express routes rather than tRPC procedures because OAuth is a
 * browser redirect dance, not an RPC — the browser has to physically navigate
 * to Google and back, which a JSON-over-POST transport can't express.
 */

const STATE_COOKIE = "g_state";
const VERIFIER_COOKIE = "g_verify";
/** The round trip to Google and back is measured in seconds, not hours. */
const HANDSHAKE_TTL_MS = 10 * 60 * 1000;

/** Categories every new account starts with, so the app is never empty. */
const STARTER_CATEGORIES = [
  { name: "Technical Deep Dive", color: "#0d5f5f" },
  { name: "Personal Reflection", color: "#d4a574" },
  { name: "Creative Exploration", color: "#7a9b8e" },
  { name: "Quick Observations", color: "#2a2a2a" },
];

function fail(res: Response, reason: string) {
  // Errors go back to the sign-in page as a code rather than a raw message, so
  // nothing from the OAuth internals is reflected into the page.
  res.redirect(`/signin?error=${encodeURIComponent(reason)}`);
}

export function mountGoogleAuth(app: Express): void {
  app.get("/api/auth/google", (req: Request, res: Response) => {
    if (!googleEnabled()) return fail(res, "google_unavailable");

    try {
      consume(`google:${clientIp(req)}`, AUTH_LIMITS.login);
    } catch {
      return fail(res, "rate_limited");
    }

    const { url, state, verifier } = buildGoogleAuthUrl();
    const options = {
      ...getSessionCookieOptions(req),
      maxAge: HANDSHAKE_TTL_MS,
    };

    res.cookie(STATE_COOKIE, state, options);
    res.cookie(VERIFIER_COOKIE, verifier, options);
    res.redirect(url);
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    if (!googleEnabled()) return fail(res, "google_unavailable");

    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    const expectedState = cookies[STATE_COOKIE];
    const verifier = cookies[VERIFIER_COOKIE];

    // Clear the handshake cookies immediately: they are single-use whether or
    // not the rest of this succeeds.
    const clearOptions = getSessionCookieOptions(req);
    res.clearCookie(STATE_COOKIE, clearOptions);
    res.clearCookie(VERIFIER_COOKIE, clearOptions);

    const { code, state, error } = req.query;
    if (typeof error === "string") return fail(res, "cancelled");
    if (typeof code !== "string" || typeof state !== "string") {
      return fail(res, "bad_response");
    }
    if (!expectedState || !verifier || state !== expectedState) {
      // Mismatched state means this callback didn't originate from us.
      return fail(res, "bad_state");
    }

    try {
      const identity = await exchangeGoogleCode(code, verifier);

      // An unverified Google address could belong to anyone, so it must never
      // be allowed to claim — or link to — an account by email.
      if (!identity.emailVerified) return fail(res, "email_unverified");

      let user = await findUserByGoogleId(identity.googleId);

      if (!user) {
        const existing = await findUserByEmail(identity.email);

        if (existing) {
          // Same verified address, existing password account: link them rather
          // than creating a confusing duplicate.
          if (existing.demoExpiresAt) return fail(res, "sandbox_conflict");
          user = await linkGoogleId(existing.id, identity.googleId, identity.avatarUrl);
        } else {
          user = await createGoogleUser({
            email: identity.email,
            googleId: identity.googleId,
            name: identity.name,
            avatarUrl: identity.avatarUrl,
          });

          // Same starting point a password signup gets.
          await getPreferences(user.id);
          await Promise.all(
            STARTER_CATEGORIES.map((category, index) =>
              createCategory({ userId: user!.id, ...category, sortOrder: index })
            )
          );
        }
      } else {
        await touchLastSignedIn(user.id);
      }

      setSessionCookie(req, res, await createSessionToken(user.id));
      res.redirect("/");
    } catch (caught) {
      console.error("[google] sign-in failed:", caught);
      fail(res, "signin_failed");
    }
  });

  if (googleEnabled()) {
    console.log(`  Google sign-in enabled → ${ENV.appUrl}/api/auth/google/callback`);
  }
}
