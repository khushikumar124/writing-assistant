import { eq } from "drizzle-orm";
import { writingSessions } from "../drizzle/schema";
import {
  createCategory,
  createIdea,
  createThought,
  getDb,
  getPreferences,
  linkThoughtsToIdea,
  saveDraft,
  updatePreferences,
} from "./db";

/**
 * Sample content for a throwaway sandbox account.
 *
 * A brand new visitor clicking "try it" needs something to react to — an empty
 * app teaches nothing about what the app is for. This gives them a streak, a
 * few thoughts to merge, and one piece already shipped, so every feature has
 * something to show.
 */

const CATEGORIES = [
  {
    name: "Technical Deep Dive",
    description:
      "Systems, architecture, and the things that break in production.",
    color: "#0d5f5f",
  },
  {
    name: "Personal Reflection",
    description:
      "Career turns, lessons learned the hard way, honest retrospectives.",
    color: "#d4a574",
  },
  {
    name: "Creative Exploration",
    description: "Where design, art, and engineering overlap.",
    color: "#7a9b8e",
  },
  {
    name: "Quick Observations",
    description: "Short takes that don't need a thousand words.",
    color: "#8a6f5c",
  },
];

const IDEAS = [
  {
    title: "What I got wrong about database indexes",
    description:
      "Three years of adding indexes to fix slow queries, and a benchmark that showed half of them were never used.",
    category: "Technical Deep Dive",
    status: "published" as const,
    platform: "medium" as const,
    publishedUrl: "https://example.com/database-indexes",
    publishedIn: "Medium",
    /** Days ago, so the shipped shelf has a plausible history. */
    publishedDaysAgo: 24,
    draft: `# What I got wrong about database indexes

For a long time my answer to a slow query was the same: add an index. It worked often enough that I stopped questioning it.

Then I ran \`pg_stat_user_indexes\` against a production database I'd been tending for three years. Of the forty-one indexes I had added, nineteen had never been scanned. Not once.

## The cost nobody mentions

An unused index isn't free. Every write pays for it.`,
  },
  {
    title: "Error messages are documentation",
    description:
      "The one piece of writing every engineer does, and mostly does badly.",
    category: "Quick Observations",
    status: "published" as const,
    platform: "substack" as const,
    publishedUrl: "https://example.com/error-messages",
    publishedIn: "Substack",
    publishedDaysAgo: 9,
    draft: `# Error messages are documentation

Nobody reads the docs. Everybody reads the error.

That asymmetry should change how much care an error message gets, and mostly it doesn't. We write \`Invalid input\` and move on, and then answer the same support question eleven times.

A good error message answers three questions: what happened, why, and what to do next.`,
  },
  {
    title: "The case for boring technology",
    description:
      "Why the most interesting thing about a stack is often how little of it is interesting.",
    category: "Personal Reflection",
    status: "in-progress" as const,
    platform: "substack" as const,
    draft: `# The case for boring technology

I have a rule now: every genuinely novel piece of technology in a system costs the team something. Not in licence fees — in the hours nobody budgets for.

The question isn't whether the new thing is better. It usually is, on the dimension its authors care about. The question is whether it is better by enough to pay for the debugging you'll do at 2am.`,
  },
  {
    title: "Reading code like a stranger",
    description:
      "A technique for reviewing your own work: come back after a week and pretend you've never seen it.",
    category: "Technical Deep Dive",
    status: "outline" as const,
    platform: "both" as const,
    draft: `# Reading code like a stranger

Outline:

- The problem: you can't see your own assumptions
- The week-long gap, and why shorter doesn't work
- Reading top-down instead of in the order you wrote it
- What to write down as you go`,
  },
  {
    title: "Notes on writing while employed full-time",
    description:
      "Forty-five minutes, four mornings a week, and what actually fits in that.",
    category: "Personal Reflection",
    status: "draft" as const,
    platform: "substack" as const,
  },
];

/** The first three get merged into the idea below, to show the mechanic off. */
const THOUGHTS = [
  {
    content:
      "The best technical writing I've read all year was a postmortem. Nobody sets out to write a postmortem well and yet.",
    tags: ["writing", "craft"],
    mergeInto: "Why postmortems are the best writing in tech",
  },
  {
    content:
      "Half-thought — the reason code review feels bad is that it's the only time most engineers get feedback on writing.",
    tags: ["review", "half-baked"],
    mergeInto: "Why postmortems are the best writing in tech",
  },
  {
    content:
      "A postmortem has a built-in structure: what happened, why, what changed. Most essays would be better with that skeleton.",
    tags: ["craft"],
    mergeInto: "Why postmortems are the best writing in tech",
  },
  {
    content:
      "Idea: a piece about the moment a codebase stops fitting in your head, and what you do differently after.",
    tags: ["ideas"],
  },
  {
    content:
      "Everyone says 'write what you know'. Nobody mentions you learn what you know by writing.",
    tags: [],
  },
  {
    content:
      "Three unrelated outages this month all traced back to a retry with no jitter.",
    tags: ["incidents"],
  },
];

function countWords(content: string): number {
  const trimmed = content.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

function daysAgo(days: number, hour = 9): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 30, 0, 0);
  return date;
}

/**
 * Fills an account with sample writing. Used both by the sandbox button and by
 * `npm run db:seed`, so the two can never drift apart.
 */
export async function seedSandbox(userId: number): Promise<void> {
  await getPreferences(userId);
  await updatePreferences(userId, {
    onboardingCompleted: true,
    defaultPlatform: "both",
  });

  for (const [index, category] of CATEGORIES.entries()) {
    await createCategory({ userId, ...category, sortOrder: index });
  }

  for (const seedIdea of IDEAS) {
    const { draft, publishedDaysAgo, ...fields } = seedIdea;
    const idea = await createIdea({
      userId,
      ...fields,
      ...(publishedDaysAgo === undefined
        ? {}
        : { publishedAt: daysAgo(publishedDaysAgo) }),
    });

    if (draft) {
      await saveDraft({
        userId,
        ideaId: idea.id,
        content: draft,
        wordCount: countWords(draft),
        characterCount: draft.length,
        platform: fields.platform,
      });
    }
  }

  // One idea built out of scattered thoughts, so the merge flow has an example.
  const mergeTarget = await createIdea({
    userId,
    title: "Why postmortems are the best writing in tech",
    description: "Built from three thoughts caught over a fortnight.",
    category: "Creative Exploration",
    status: "draft",
    platform: "both",
  });

  const mergedIds: number[] = [];
  for (const thought of THOUGHTS) {
    const created = await createThought({
      userId,
      content: thought.content,
      tags: thought.tags.length ? JSON.stringify(thought.tags) : null,
    });
    if (thought.mergeInto) mergedIds.push(created.id);
  }
  await linkThoughtsToIdea(mergedIds, mergeTarget.id, userId);

  await backdateWritingHistory(userId);
}

/**
 * `saveDraft` stamps every session with today's date, which would show the
 * account as a one-day streak. Rewrite the history so the dashboard has a
 * four-day streak and a plausible run of past activity to display.
 */
async function backdateWritingHistory(userId: number): Promise<void> {
  const db = getDb();
  await db.delete(writingSessions).where(eq(writingSessions.userId, userId));

  for (const offset of [0, 1, 2, 3, 6, 7, 8, 12, 13, 20]) {
    const day = daysAgo(offset, 7);
    await db.insert(writingSessions).values({
      userId,
      startedAt: day,
      endedAt: day,
      wordsWritten: 180 + ((offset * 37) % 250),
      createdAt: day,
    });
  }
}
