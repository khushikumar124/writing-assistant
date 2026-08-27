import { toDayKey } from "@shared/streak";
import {
  CURATED_PROMPTS,
  promptOfTheDay,
  type CuratedPrompt,
} from "@shared/prompts";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { createPrompt, deletePrompt, listPrompts } from "../db";

/**
 * Discover, as data.
 *
 * The curated library lives in `shared/prompts.ts` under version control; only
 * a writer's own additions are stored per-account. Merging happens here so the
 * client sees one list and doesn't care where a prompt came from.
 */
export const promptsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const mine = await listPrompts(ctx.user.id);

    const all: (CuratedPrompt & { own: boolean; dbId: number | null })[] = [
      ...CURATED_PROMPTS.map(prompt => ({ ...prompt, own: false, dbId: null })),
      ...mine.map(prompt => ({
        id: `own-${prompt.id}`,
        text: prompt.text,
        kind: prompt.kind as CuratedPrompt["kind"],
        own: true,
        dbId: prompt.id,
      })),
    ];

    return {
      prompts: all,
      /** Same prompt all day, on every device. */
      today: promptOfTheDay(toDayKey(new Date()), all),
    };
  }),

  create: protectedProcedure
    .input(
      z.object({
        text: z.string().trim().min(1, "Write the prompt first.").max(300),
        kind: z.string().trim().min(1).max(40).default("general"),
      })
    )
    .mutation(({ ctx, input }) =>
      createPrompt({ userId: ctx.user.id, text: input.text, kind: input.kind })
    ),

  /** Only ever deletes the user's own rows — curated prompts have no owner. */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deletePrompt(input.id, ctx.user.id);
      if (!deleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That prompt isn't yours to delete.",
        });
      }
      return { success: true } as const;
    }),
});
