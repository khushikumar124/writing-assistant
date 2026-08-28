/**
 * Domain vocabulary shared by the client, the server, and the database schema.
 *
 * These live here rather than in `drizzle/schema.ts` so the client can import
 * them as plain values without pulling Drizzle into the browser bundle.
 */

export const PLATFORMS = ["substack", "medium", "both"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const IDEA_STATUSES = [
  "draft",
  "outline",
  "in-progress",
  "completed",
  "published",
] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const RESEARCH_SOURCES = [
  "article",
  "paper",
  "video",
  "book",
  "other",
] as const;
export type ResearchSource = (typeof RESEARCH_SOURCES)[number];

export const USER_ROLES = ["user", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * How often someone wants a nudge. "custom" pairs with a set of weekdays, so
 * "every Tuesday and Friday" is expressible without a cron string.
 */
export const REMINDER_FREQUENCIES = [
  "off",
  "daily",
  "weekly",
  "monthly",
  "custom",
] as const;
export type ReminderFrequency = (typeof REMINDER_FREQUENCIES)[number];

export const REMINDER_LABELS: Record<ReminderFrequency, string> = {
  off: "Never",
  daily: "Every day",
  weekly: "Once a week",
  monthly: "Once a month",
  custom: "On days I choose",
};
