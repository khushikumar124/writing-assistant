import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { search } from "../db";

export const searchRouter = router({
  /**
   * One query across ideas, thoughts, and draft prose. Short terms return
   * nothing rather than everything — a single letter matching the whole
   * library is noise, not a result.
   */
  query: protectedProcedure
    .input(z.object({ term: z.string().trim().max(200) }))
    .query(({ ctx, input }) =>
      input.term.length < 2 ? [] : search(ctx.user.id, input.term)
    ),
});
