import { IDEA_STATUSES } from "@shared/domain";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { listCategories, search } from "../db";

export const searchRouter = router({
  /**
   * One query across ideas, thoughts and draft prose, ranked by relevance
   * rather than date. Short terms return nothing rather than everything — a
   * single letter matching the whole library is noise, not a result.
   */
  query: protectedProcedure
    .input(
      z.object({
        term: z.string().trim().max(200),
        kinds: z.array(z.enum(["idea", "thought", "draft"])).optional(),
        status: z.enum(IDEA_STATUSES).optional(),
        category: z.string().max(100).optional(),
        /** Days back; omitted means all time. */
        withinDays: z.number().int().positive().max(3650).optional(),
      })
    )
    .query(({ ctx, input }) => {
      if (input.term.length < 2) return [];

      return search(ctx.user.id, input.term, {
        kinds: input.kinds,
        status: input.status,
        category: input.category,
        since: input.withinDays
          ? new Date(Date.now() - input.withinDays * 86_400_000)
          : undefined,
      });
    }),

  /** The categories a filter can offer, so the UI never invents one. */
  facets: protectedProcedure.query(async ({ ctx }) => ({
    categories: (await listCategories(ctx.user.id)).map(c => c.name),
  })),
});
