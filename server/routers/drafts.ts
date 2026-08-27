import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { PLATFORMS } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import {
  deleteDraft,
  getDraftByIdeaId,
  getIdea,
  listDrafts,
  recordWritingActivity,
  saveDraft,
} from "../db";

/** Words are whitespace-delimited runs; empty content is zero, not one. */
export function countWords(content: string): number {
  const trimmed = content.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export const draftsRouter = router({
  getByIdeaId: protectedProcedure
    .input(z.object({ ideaId: z.number().int().positive() }))
    .query(({ ctx, input }) => getDraftByIdeaId(input.ideaId, ctx.user.id)),

  list: protectedProcedure.query(({ ctx }) => listDrafts(ctx.user.id)),

  /**
   * Autosave target. Counts are derived server-side so the numbers on the
   * dashboard can't drift from the stored prose.
   */
  save: protectedProcedure
    .input(
      z.object({
        ideaId: z.number().int().positive(),
        content: z.string().max(500_000),
        platform: z.enum(PLATFORMS).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const idea = await getIdea(input.ideaId, ctx.user.id);
      if (!idea) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That idea no longer exists.",
        });
      }

      const previous = await getDraftByIdeaId(input.ideaId, ctx.user.id);
      const wordCount = countWords(input.content);

      const saved = await saveDraft({
        userId: ctx.user.id,
        ideaId: input.ideaId,
        content: input.content,
        wordCount,
        characterCount: input.content.length,
        platform: input.platform,
      });

      // Only words actually added count towards the streak, so an autosave
      // that changed nothing doesn't award a writing day.
      await recordWritingActivity(
        ctx.user.id,
        input.ideaId,
        wordCount - (previous?.wordCount ?? 0)
      );
      return saved;
    }),

  delete: protectedProcedure
    .input(z.object({ draftId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteDraft(input.draftId, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That draft no longer exists.",
        });
      }
      return { success: true } as const;
    }),
});
