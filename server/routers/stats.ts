import {
  calculateStreak,
  daysSinceLastWrote,
  habitMessage,
  toDayKeyInZone,
} from "@shared/streak";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  listDrafts,
  listIdeas,
  listPublishedIdeas,
  listThoughts,
  getPreferences,
  listUnlinkedThoughts,
  listWritingSessionTimes,
} from "../db";

export const statsRouter = router({
  /** Everything the dashboard needs, in one round trip. */
  dashboard: protectedProcedure
    /**
     * The browser's IANA timezone. Streaks are answering "did I write today?",
     * which only means anything in the asker's own timezone — the server's is
     * an accident of where it happens to be hosted.
     */
    .input(z.object({ timeZone: z.string().max(64).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const timeZone = input?.timeZone || "UTC";
      const [
        ideas,
        drafts,
        thoughts,
        unlinked,
        published,
        sessionTimes,
        preferences,
      ] = await Promise.all([
        listIdeas(ctx.user.id),
        listDrafts(ctx.user.id),
        listThoughts(ctx.user.id),
        listUnlinkedThoughts(ctx.user.id),
        listPublishedIdeas(ctx.user.id),
        listWritingSessionTimes(ctx.user.id),
        getPreferences(ctx.user.id),
      ]);

      const today = toDayKeyInZone(new Date(), timeZone);
      const days = [
        ...new Set(
          sessionTimes.map(s => toDayKeyInZone(s.startedAt, timeZone))
        ),
      ];

      // Words added today, in the reader's zone — the number a daily goal is
      // measured against.
      const wordsToday = sessionTimes
        .filter(s => toDayKeyInZone(s.startedAt, timeZone) === today)
        .reduce((sum, s) => sum + s.wordsWritten, 0);
      const streak = calculateStreak(days, today);
      const daysSince = daysSinceLastWrote(days, today);

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
        wordsToday,
        /** The daily target, 0 when the user hasn't set one. */
        goal: preferences.dailyWordGoal,
        /**
         * The single draft to drop straight back into. Skips anything already
         * shipped, because "continue writing" should not reopen finished work.
         */
        resume: ideas.find(idea => idea.status !== "published") ?? null,
        /** Most recently touched ideas, for the "pick up where you left off" list. */
        recentIdeas: ideas.slice(0, 5),
        /** The last few things shipped, for the dashboard's shelf preview. */
        recentlyShipped: published.slice(0, 3),
      };
    }),
});
