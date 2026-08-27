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
