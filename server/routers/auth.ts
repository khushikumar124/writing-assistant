import { PASSWORD_MIN_LENGTH } from "@shared/const";
import { TRPCError } from "@trpc/server";
import crypto from "node:crypto";
import { z } from "zod";
import {
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  setSessionCookie,
  verifyPassword,
} from "../_core/auth";
import {
  DEMO_TTL_MS,
  ENV,
  PASSWORD_RESET_TTL_MS,
  googleEnabled,
} from "../_core/env";
import { passwordResetEmail, sendMail } from "../_core/mail";
import { AUTH_LIMITS, clientIp, consume } from "../_core/rateLimit";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  consumePasswordReset,
  createCategory,
  createDemoUser,
  createPasswordReset,
  createUser,
  findUserByEmail,
  findUserById,
  getPreferences,
  purgeExpiredDemoUsers,
  toPublicUser,
  touchLastSignedIn,
  updatePasswordHash,
} from "../db";
import { seedSandbox } from "../sandbox";

/** Categories every new account starts with, so the app is never empty. */
const STARTER_CATEGORIES = [
  { name: "Technical Deep Dive", color: "#0d5f5f" },
  { name: "Personal Reflection", color: "#d4a574" },
  { name: "Creative Exploration", color: "#7a9b8e" },
  { name: "Quick Observations", color: "#2a2a2a" },
];

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
    ),
});

/** SHA-256 of the raw token. Only this ever touches the database. */
function digest(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const authRouter = router({
  /** The signed-in user, or null. Drives every auth check on the client. */
  me: publicProcedure.query(({ ctx }) => ctx.user),

  /** Whether the "Try it without an account" button should be offered. */
  demoAvailable: publicProcedure.query(() => ENV.demoMode),

  /** Whether to show "Continue with Google" — off unless credentials exist. */
  googleAvailable: publicProcedure.query(() => googleEnabled()),

  signup: publicProcedure
    .input(
      credentials.extend({
        name: z.string().trim().min(1, "Tell us what to call you.").max(80),
      })
    )
    .mutation(async ({ ctx, input }) => {
      consume(`signup:${clientIp(ctx.req)}`, AUTH_LIMITS.signup);

      const existing = await findUserByEmail(input.email);
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An account with that email already exists.",
        });
      }

      const user = await createUser({
        email: input.email,
        passwordHash: await hashPassword(input.password),
        name: input.name,
      });

      // Give the account a usable starting point rather than a blank slate.
      await getPreferences(user.id);
      await Promise.all(
        STARTER_CATEGORIES.map((category, index) =>
          createCategory({ userId: user.id, ...category, sortOrder: index })
        )
      );

      setSessionCookie(ctx.req, ctx.res, await createSessionToken(user.id));
      return toPublicUser(user);
    }),

  login: publicProcedure.input(credentials).mutation(async ({ ctx, input }) => {
    // Limit by IP *and* by account, so one attacker can't lock everyone out
    // and a distributed attack still can't grind a single mailbox.
    consume(`login:ip:${clientIp(ctx.req)}`, AUTH_LIMITS.login);
    consume(`login:email:${input.email}`, AUTH_LIMITS.login);

    const user = await findUserByEmail(input.email);

    // Deliberately identical failure for "no such user" and "wrong password",
    // so the endpoint can't be used to enumerate registered emails.
    const invalid = new TRPCError({
      code: "UNAUTHORIZED",
      message: "That email and password don't match.",
    });

    if (!user) {
      // Spend roughly the same time as a real comparison would.
      await verifyPassword(
        input.password,
        "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidiu"
      );
      throw invalid;
    }

    // A Google-only account has no password to check. Say so plainly rather
    // than "wrong password" — the user isn't wrong, they used the wrong door.
    if (!user.passwordHash) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "This account signs in with Google. Use the Google button above.",
      });
    }

    if (!(await verifyPassword(input.password, user.passwordHash))) {
      throw invalid;
    }

    await touchLastSignedIn(user.id);
    setSessionCookie(ctx.req, ctx.res, await createSessionToken(user.id));
    return toPublicUser(user);
  }),

  /**
   * Hands out a private sandbox: a fresh throwaway account, seeded with sample
   * writing, that deletes itself after a day. There is no shared demo login,
   * so one visitor can never see or wreck another visitor's work.
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
      email: `sandbox-${handle}@demo.invalid`,
      // Unguessable and never shown: a sandbox is reachable only by its cookie.
      passwordHash: await hashPassword(crypto.randomBytes(24).toString("hex")),
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

  /**
   * Always reports success, whether or not the address is registered —
   * otherwise this endpoint tells an attacker which emails have accounts.
   */
  requestPasswordReset: publicProcedure
    .input(z.object({ email: z.string().trim().toLowerCase().email() }))
    .mutation(async ({ ctx, input }) => {
      consume(`reset:ip:${clientIp(ctx.req)}`, AUTH_LIMITS.passwordReset);
      consume(`reset:email:${input.email}`, AUTH_LIMITS.passwordReset);

      const user = await findUserByEmail(input.email);
      if (user && !user.demoExpiresAt) {
        const token = crypto.randomBytes(32).toString("base64url");
        await createPasswordReset(
          user.id,
          digest(token),
          new Date(Date.now() + PASSWORD_RESET_TTL_MS)
        );

        const resetUrl = `${ENV.appUrl}/reset-password?token=${token}`;
        await sendMail({ to: user.email, ...passwordResetEmail(resetUrl) });
      }

      return { success: true } as const;
    }),

  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        password: z
          .string()
          .min(
            PASSWORD_MIN_LENGTH,
            `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
          ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = await consumePasswordReset(digest(input.token));
      if (userId === null) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "That reset link has expired or already been used.",
        });
      }

      await updatePasswordHash(userId, await hashPassword(input.password));

      // Sign them straight in — they just proved they own the mailbox.
      const user = await findUserById(userId);
      if (user) {
        await touchLastSignedIn(user.id);
        setSessionCookie(ctx.req, ctx.res, await createSessionToken(user.id));
      }

      return { success: true } as const;
    }),

  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(PASSWORD_MIN_LENGTH),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await findUserByEmail(ctx.user.email);
      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
      }

      // Google-only accounts have no current password to confirm. Setting a
      // first one goes through the emailed reset link instead, which proves
      // the mailbox rather than trusting an empty field.
      if (!user.passwordHash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "This account signs in with Google. Use \u201cForgot password\u201d on the sign-in page to set one.",
        });
      }

      if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Your current password is incorrect.",
        });
      }

      await updatePasswordHash(user.id, await hashPassword(input.newPassword));
      return { success: true } as const;
    }),
});
