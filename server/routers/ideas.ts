import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  IDEA_STATUSES,
  PLATFORMS,
  RESEARCH_SOURCES,
} from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import {
  addResearch,
  createIdea,
  deleteIdea,
  deleteResearch,
  getIdea,
  listDeletedIdeas,
  listIdeas,
  listPublishedIdeas,
  listResearch,
  purgeTrash,
  restoreIdea,
  softDeleteIdea,
  updateIdea,
} from "../db";

const platform = z.enum(PLATFORMS);
const status = z.enum(IDEA_STATUSES);

export const ideasRouter = router({
  list: protectedProcedure.query(({ ctx }) => listIdeas(ctx.user.id)),

  /** The shipped shelf — everything that actually went out. */
  listPublished: protectedProcedure.query(({ ctx }) =>
    listPublishedIdeas(ctx.user.id)
  ),

  listDeleted: protectedProcedure.query(({ ctx }) =>
    listDeletedIdeas(ctx.user.id)
  ),

  get: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const idea = await getIdea(input.id, ctx.user.id);
      if (!idea) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That idea no longer exists.",
        });
      }
      return idea;
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().min(1, "Give the idea a title.").max(200),
        description: z.string().trim().max(2000).optional(),
        /** Free text: categories are user-defined, not a fixed enum. */
        category: z.string().trim().min(1, "Pick a category.").max(100),
        platform: platform.optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      createIdea({
        userId: ctx.user.id,
        title: input.title,
        description: input.description,
        category: input.category,
        platform: input.platform ?? "both",
        status: "draft",
      })
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(1).max(200).optional(),
        description: z.string().trim().max(2000).optional(),
        category: z.string().trim().min(1).max(100).optional(),
        status: status.optional(),
        tags: z.array(z.string().trim().min(1)).optional(),
        outline: z.string().optional(),
        platform: platform.optional(),
        publishedUrl: z.string().url().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, tags, ...rest } = input;
      const updated = await updateIdea(id, ctx.user.id, {
        ...rest,
        ...(tags ? { tags: JSON.stringify(tags) } : {}),
      });

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That idea no longer exists.",
        });
      }
      return updated;
    }),

  /**
   * Marks a piece as shipped. This is the moment the app exists for, so it
   * records where and when rather than just flipping a status — the shelf is
   * only interesting if it remembers the details.
   */
  markShipped: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        url: z
          .string()
          .trim()
          .url("That doesn't look like a link.")
          .nullable()
          .optional(),
        publishedIn: z.string().trim().max(100).optional(),
        publishedAt: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await updateIdea(input.id, ctx.user.id, {
        status: "published",
        publishedUrl: input.url ?? null,
        publishedIn: input.publishedIn || null,
        publishedAt: input.publishedAt ?? new Date(),
      });

      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That idea no longer exists.",
        });
      }
      return updated;
    }),

  /** Takes a piece back off the shelf, e.g. when a link was wrong. */
  unmarkShipped: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await updateIdea(input.id, ctx.user.id, {
        status: "completed",
        publishedAt: null,
      });
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That idea no longer exists.",
        });
      }
      return updated;
    }),

  /** Moves to the bin. Undoable from the toast, or from the bin later. */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await softDeleteIdea(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That idea no longer exists.",
        });
      }
      return { success: true, id: input.id } as const;
    }),

  restore: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const restored = await restoreIdea(input.id, ctx.user.id);
      if (!restored) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That idea is gone for good.",
        });
      }
      return restored;
    }),

  deleteForever: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteIdea(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That idea no longer exists.",
        });
      }
      return { success: true } as const;
    }),

  /** Empties the bin for good — the only irreversible bulk action in the app. */
  emptyTrash: protectedProcedure.mutation(async ({ ctx }) => {
    const purged = await purgeTrash(ctx.user.id);
    return { purged };
  }),

  listResearch: protectedProcedure
    .input(z.object({ ideaId: z.number().int().positive() }))
    .query(({ ctx, input }) => listResearch(input.ideaId, ctx.user.id)),

  addResearch: protectedProcedure
    .input(
      z.object({
        ideaId: z.number().int().positive(),
        title: z.string().trim().min(1).max(200),
        url: z.string().url().optional(),
        notes: z.string().trim().max(2000).optional(),
        source: z.enum(RESEARCH_SOURCES).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Confirm the idea belongs to this user before hanging research off it.
      const idea = await getIdea(input.ideaId, ctx.user.id);
      if (!idea) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That idea no longer exists.",
        });
      }
      return addResearch({ ...input, userId: ctx.user.id });
    }),

  deleteResearch: protectedProcedure
    .input(z.object({ researchId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteResearch(input.researchId, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That note no longer exists.",
        });
      }
      return { success: true } as const;
    }),
});
