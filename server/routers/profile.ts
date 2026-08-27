import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import {
  findUserById,
  findUserByUsername,
  listPublishedIdeas,
  toPublicUser,
  updateProfile,
} from "../db";

/**
 * Handles are lowercase letters, digits, hyphens and underscores. Kept narrow
 * so a handle can never collide with an app route or need URL-escaping.
 */
const username = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "At least 2 characters.")
  .max(30, "At most 30 characters.")
  .regex(
    /^[a-z0-9][a-z0-9_-]*$/,
    "Letters, numbers, hyphens and underscores only."
  );

/** Words that would shadow a real route if someone claimed them. */
const RESERVED = new Set([
  "admin",
  "api",
  "signin",
  "signup",
  "settings",
  "ideas",
  "thoughts",
  "discover",
  "search",
  "shipped",
  "trash",
  "about",
  "privacy",
  "terms",
  "reset-password",
  "support",
  "help",
]);

export const profileRouter = router({
  /** The signed-in user's own profile, including fields `auth.me` doesn't carry. */
  mine: protectedProcedure.query(async ({ ctx }) => {
    const user = await findUserById(ctx.user.id);
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Account not found." });
    }
    return toPublicUser(user);
  }),

  update: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(80).optional(),
        bio: z.string().trim().max(280).optional(),
        username: username.nullable().optional(),
        publicProfile: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.username) {
        if (RESERVED.has(input.username)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "That handle is reserved. Try another.",
          });
        }

        const existing = await findUserByUsername(input.username);
        if (existing && existing.id !== ctx.user.id) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "That handle is taken.",
          });
        }
      }

      if (input.publicProfile) {
        const current = await findUserById(ctx.user.id);

        // A profile can't be public without a handle to reach it by.
        if (!input.username && !current?.username) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Claim a handle before making your shelf public.",
          });
        }

        // Throwaway sandboxes can't publish: a public page that anyone can
        // mint anonymously and that deletes itself in a day is a spam vector,
        // not a feature.
        if (current?.demoExpiresAt) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Make a real account to publish a shelf.",
          });
        }
      }

      const updated = await updateProfile(ctx.user.id, input);
      return toPublicUser(updated);
    }),

  /**
   * The public shelf at `/@handle`. Anonymous — no session required — and
   * returns only what the owner chose to publish: title, blurb, link, date.
   * Draft prose is never exposed here.
   */
  publicShelf: publicProcedure
    .input(z.object({ username: z.string().trim().min(1).max(30) }))
    .query(async ({ input }) => {
      const user = await findUserByUsername(input.username);

      // Same 404 for "no such handle" and "not public", so the endpoint can't
      // be used to discover which handles exist.
      if (!user || !user.publicProfile || !user.username) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No shelf here." });
      }

      const published = await listPublishedIdeas(user.id);

      return {
        name: user.name,
        username: user.username,
        bio: user.bio,
        memberSince: user.createdAt,
        totalWords: published.reduce((sum, idea) => sum + idea.wordCount, 0),
        pieces: published.map(idea => ({
          id: idea.id,
          title: idea.title,
          description: idea.description,
          category: idea.category,
          url: idea.publishedUrl,
          publishedIn: idea.publishedIn,
          publishedAt: idea.publishedAt,
          wordCount: idea.wordCount,
        })),
      };
    }),
});
