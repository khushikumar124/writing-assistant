import { COOKIE_NAME, SESSION_TTL_MS } from "@shared/const";
import bcrypt from "bcryptjs";
import { parse as parseCookieHeader } from "cookie";
import type { Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";
import { findUserById, toPublicUser } from "../db";
import type { PublicUser } from "../../drizzle/schema";
import { ENV } from "./env";
import { getSessionCookieOptions } from "./cookies";

const BCRYPT_ROUNDS = 10;

const secretKey = new TextEncoder().encode(ENV.sessionSecret);

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Signs a short JWT identifying the user. The cookie is the only transport. */
export async function createSessionToken(userId: number): Promise<string> {
  return new SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + SESSION_TTL_MS) / 1000))
    .sign(secretKey);
}

async function readUserIdFromToken(
  token: string | undefined
): Promise<number | null> {
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });
    const userId = Number.parseInt(String(payload.sub ?? ""), 10);
    return Number.isInteger(userId) ? userId : null;
  } catch {
    // Expired, tampered with, or signed by a previous SESSION_SECRET.
    return null;
  }
}

/**
 * Resolves the signed-in user for a request, or `null` when there is no valid
 * session. Never throws — public procedures rely on the null case.
 */
export async function authenticateRequest(
  req: Request
): Promise<PublicUser | null> {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const userId = await readUserIdFromToken(cookies[COOKIE_NAME]);
  if (userId === null) return null;

  const user = await findUserById(userId);
  return user ? toPublicUser(user) : null;
}

export function setSessionCookie(
  req: Request,
  res: Response,
  token: string
): void {
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
}
