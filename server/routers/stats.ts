import {
  calculateStreak,
  daysSinceLastWrote,
  habitMessage,
  toDayKey,
} from "@shared/streak";
import { protectedProcedure, router } from "../_core/trpc";
import {
  listDrafts,
  listIdeas,
  listPublishedIdeas,
  listThoughts,
  listUnlinkedThoughts,
  listWritingDays,
} from "../db";

export const statsRouter = router({
  /** Everything the dashboard needs, in one round trip. */
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const [ideas, drafts, thoughts, unlinked, published, writingDays] =
      await Promise.all([
        listIdeas(ctx.user.id),
        listDrafts(ctx.user.id),
        listThoughts(ctx.user.id),
        listUnlinkedThoughts(ctx.user.id),
        listPublishedIdeas(ctx.user.id),
        listWritingDays(ctx.user.id),
      ]);

    const today = toDayKey(new Date());
    const streak = calculateStreak(writingDays, today);
    const daysSince = daysSinceLastWrote(writingDays, today);

    const byStatus = ideas.reduce<Record<string, number>>((acc, idea) => {
      acc[idea.status] = (acc[idea.status] ?? 0) + 1;
      return acc;
    }, {});

    const thisYear = new Date().getFullYear();

    return {
      totals: {
        ideas: ideas.length,
        thoughts: thoughts.length,
        /** Thoughts with nowhere to go yet — the pile worth sorting. */
        unlinkedThoughts: unlinked.length,
        drafts: drafts.length,
        published: published.length,
        inProgress: (byStatus["in-progress"] ?? 0) + (byStatus.outline ?? 0),
        words: drafts.reduce((sum, draft) => sum + draft.wordCount, 0),
        /** Words that actually went out this year — the number worth showing off. */
        wordsPublishedThisYear: published
          .filter(idea => idea.publishedAt?.getFullYear() === thisYear)
          .reduce((sum, idea) => sum + idea.wordCount, 0),
      },
      byStatus,
      streak,
      daysSinceLastWrote: daysSince,
      message: habitMessage(daysSince, streak),
      /** Most recently touched ideas, for the "pick up where you left off" list. */
      recentIdeas: ideas.slice(0, 5),
      /** The last few things shipped, for the dashboard's shelf preview. */
      recentlyShipped: published.slice(0, 3),
    };
  }),
});
