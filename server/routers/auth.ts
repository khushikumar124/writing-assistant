import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";
import {
  clearSessionCookie,
  createSessionToken,
  setSessionCookie,
} from "../_core/auth";
import { DEMO_TTL_MS, ENV, googleEnabled } from "../_core/env";
import { AUTH_LIMITS, clientIp, consume } from "../_core/rateLimit";
import { publicProcedure, router } from "../_core/trpc";
import { createDemoUser, purgeExpiredDemoUsers, toPublicUser } from "../db";
import { seedSandbox } from "../sandbox";

/**
 * Sessions.
 *
 * Signing in happens at `/api/auth/google` — OAuth is a browser redirect, which
 * a JSON transport can't express — so what is left here is the state around a
 * session rather than the act of creating one from credentials.
 *
 * There is deliberately no password anywhere in this app: no signup form, no
 * reset flow, no hashes at rest. Google is the only door.
 */
export const authRouter = router({
  /** The signed-in user, or null. Drives every auth check on the client. */
  me: publicProcedure.query(({ ctx }) => ctx.user),

  /** Whether to show "Continue with Google" — off unless credentials exist. */
  googleAvailable: publicProcedure.query(() => googleEnabled()),

  /** Whether the "Try it without an account" button should be offered. */
  demoAvailable: publicProcedure.query(() => ENV.demoMode),

  /**
   * Hands out a private sandbox: a throwaway account, seeded with sample
   * writing, that deletes itself after a day. No credentials are involved, so
   * it doubles as the way to run the app locally without Google configured.
   */
  startSandbox: publicProcedure.mutation(async ({ ctx }) => {
    if (!ENV.demoMode) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Demo mode is disabled.",
      });
    }
    consume(`demo:${clientIp(ctx.req)}`, AUTH_LIMITS.demo);

    // Opportunistic cleanup: expired sandboxes go out with each new one.
    await purgeExpiredDemoUsers();

    const handle = crypto.randomBytes(8).toString("hex");
    const user = await createDemoUser({
      // Reachable only by its cookie, and never a real address, so it cannot
      // collide with a Google account someone signs in with later.
      email: `sandbox-${handle}@demo.invalid`,
      name: "Guest writer",
      expiresAt: new Date(Date.now() + DEMO_TTL_MS),
    });

    await seedSandbox(user.id);

    setSessionCookie(ctx.req, ctx.res, await createSessionToken(user.id));
    return toPublicUser(user);
  }),

  logout: publicProcedure.mutation(({ ctx }) => {
    clearSessionCookie(ctx.req, ctx.res);
    return { success: true } as const;
  }),
});
