import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { ENV } from "./env";

/**
 * "Continue with Google", implemented directly against Google's OpenID Connect
 * endpoints.
 *
 * There is no OAuth library here on purpose: the authorization-code flow is
 * three HTTP calls, and `jose` (already a dependency for session tokens) does
 * the one genuinely hard part — verifying Google's signature on the id_token
 * against their rotating public keys. Pulling in passport or openid-client
 * would add a dependency tree larger than this file to save about forty lines.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

/** Cached across requests: fetching Google's keys per sign-in would be rude. */
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

/** Where Google sends the browser back. Must match the console entry exactly. */
export function googleRedirectUri(): string {
  return `${ENV.appUrl}/api/auth/google/callback`;
}

export type GoogleIdentity = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
};

/** Base64url without padding, which is what PKCE and state both want. */
function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

function s256(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

/**
 * Builds the URL to send the browser to, plus the two secrets that have to
 * survive the round trip in cookies:
 *
 *   - `state` guards against CSRF: a callback whose state doesn't match the
 *     cookie we set is someone else's request, not ours.
 *   - `verifier` is PKCE. Google doesn't require it for confidential clients,
 *     but it costs nothing and closes code-interception attacks.
 */
export function buildGoogleAuthUrl(): {
  url: string;
  state: string;
  verifier: string;
} {
  const state = randomToken(16);
  const verifier = randomToken(32);

  const params = new URLSearchParams({
    client_id: ENV.googleClientId ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: s256(verifier),
    code_challenge_method: "S256",
    // Always show the picker rather than silently reusing one Google session,
    // because shared machines are common and surprise-signing-in is hostile.
    prompt: "select_account",
  });

  return { url: `${AUTH_ENDPOINT}?${params}`, state, verifier };
}

/**
 * Exchanges the one-time code for tokens and verifies the identity Google
 * asserts. Throws if anything about the token is wrong — a caller should treat
 * any throw as "sign-in failed", never as "sign in anyway".
 */
export async function exchangeGoogleCode(
  code: string,
  verifier: string
): Promise<GoogleIdentity> {
  if (!ENV.googleClientId || !ENV.googleClientSecret) {
    throw new Error("Google sign-in is not configured.");
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google rejected the code exchange (${response.status}).`);
  }

  const tokens = (await response.json()) as { id_token?: string };
  if (!tokens.id_token) {
    throw new Error("Google's response contained no id_token.");
  }

  // Signature, issuer and audience are all checked here. Skipping any one of
  // them would let a token minted for a different app sign someone in.
  const { payload } = await jwtVerify(tokens.id_token, googleKeys, {
    issuer: ISSUERS,
    audience: ENV.googleClientId,
  });

  const email =
    typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  if (!payload.sub || !email) {
    throw new Error("Google's token was missing a subject or email.");
  }

  return {
    googleId: String(payload.sub),
    email,
    // Google sends this as a boolean or the string "true" depending on flow.
    emailVerified:
      payload.email_verified === true || payload.email_verified === "true",
    name: typeof payload.name === "string" ? payload.name : null,
    avatarUrl: typeof payload.picture === "string" ? payload.picture : null,
  };
}
