import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import {
  IDEA_STATUSES,
  PLATFORMS,
  RESEARCH_SOURCES,
  USER_ROLES,
} from "../shared/domain";

export {
  IDEA_STATUSES,
  PLATFORMS,
  RESEARCH_SOURCES,
  USER_ROLES,
  type IdeaStatus,
  type Platform,
  type ResearchSource,
  type UserRole,
} from "../shared/domain";

/**
 * Timestamps are stored as Unix epoch seconds and surfaced as `Date` objects.
 * SQLite has no native date type, so this keeps sorting cheap and types honest.
 */
const timestamp = (name: string) => integer(name, { mode: "timestamp" });

const createdAt = () =>
  timestamp("createdAt")
    .notNull()
    .default(sql`(unixepoch())`);

const updatedAt = () =>
  timestamp("updatedAt")
    .notNull()
    .default(sql`(unixepoch())`);

/**
 * Accounts. Sign-in is Google only — there is no password anywhere in this
 * schema, which also means there is no password to leak.
 */
export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull(),
    /** Google's stable subject id. The only way into an account. */
    googleId: text("googleId"),
    avatarUrl: text("avatarUrl"),
    name: text("name"),
    role: text("role", { enum: USER_ROLES }).notNull().default("user"),
    /**
     * Handle for the public shelf at `/@handle`. Null until someone claims one,
     * because an account is perfectly usable without ever being public.
     */
    username: text("username"),
    /** Opt-in: nothing is readable by strangers unless this is explicitly on. */
    publicProfile: integer("publicProfile", { mode: "boolean" }).notNull().default(false),
    bio: text("bio"),
    /**
     * Set on throwaway sandbox accounts handed out by the demo button. A row
     * with a past `demoExpiresAt` is garbage and gets purged.
     */
    demoExpiresAt: timestamp("demoExpiresAt"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    lastSignedIn: timestamp("lastSignedIn"),
  },
  table => [
    uniqueIndex("users_email_unique").on(table.email),
    uniqueIndex("users_username_unique").on(table.username),
    uniqueIndex("users_googleId_unique").on(table.googleId),
  ]
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** The shape that crosses the wire. Nothing on a user row is secret. */
export type PublicUser = User;

/**
 * Writing ideas. The centre of the data model: everything else hangs off these.
 */
export const ideas = sqliteTable(
  "ideas",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    /** Free-text category name, matched against the user's own categories. */
    category: text("category").notNull(),
    platform: text("platform", { enum: PLATFORMS }).notNull().default("both"),
    status: text("status", { enum: IDEA_STATUSES }).notNull().default("draft"),
    /** JSON-encoded string array. */
    tags: text("tags"),
    outline: text("outline"),
    wordCount: integer("wordCount").notNull().default(0),
    publishedUrl: text("publishedUrl"),
    /** When it actually went out. Drives the shipped shelf's ordering. */
    publishedAt: timestamp("publishedAt"),
    /** Where it went out, free text — "Substack", "my blog", a newsletter name. */
    publishedIn: text("publishedIn"),
    targetPublishDate: timestamp("targetPublishDate"),
    /**
     * Soft delete. Nothing a writer typed is ever destroyed on a stray click;
     * rows sit here until the user empties the bin or 30 days pass.
     */
    deletedAt: timestamp("deletedAt"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  table => [index("ideas_userId_idx").on(table.userId)]
);

export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = typeof ideas.$inferInsert;

/** Links and notes gathered while researching an idea. */
export const research = sqliteTable(
  "research",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    ideaId: integer("ideaId")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url"),
    notes: text("notes"),
    source: text("source", { enum: RESEARCH_SOURCES }).default("other"),
    createdAt: createdAt(),
  },
  table => [index("research_ideaId_idx").on(table.ideaId)]
);

export type Research = typeof research.$inferSelect;
export type InsertResearch = typeof research.$inferInsert;

/**
 * Categories are user-defined rather than a fixed enum, so someone writing about
 * both distributed systems and beekeeping isn't forced into preset buckets.
 */
export const userCategories = sqliteTable(
  "userCategories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    /** Hex colour, e.g. `#0d5f5f`. */
    color: text("color"),
    sortOrder: integer("sortOrder").notNull().default(0),
    createdAt: createdAt(),
  },
  table => [uniqueIndex("userCategories_user_name_unique").on(table.userId, table.name)]
);

export type UserCategory = typeof userCategories.$inferSelect;
export type InsertUserCategory = typeof userCategories.$inferInsert;

/** Per-user settings, one row per user. */
export const userPreferences = sqliteTable("userPreferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  defaultPlatform: text("defaultPlatform", { enum: PLATFORMS }).notNull().default("both"),
  onboardingCompleted: integer("onboardingCompleted", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type UserPreference = typeof userPreferences.$inferSelect;
export type InsertUserPreference = typeof userPreferences.$inferInsert;

/** The actual prose. One draft per idea, autosaved from the editor. */
export const drafts = sqliteTable(
  "drafts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ideaId: integer("ideaId")
      .notNull()
      .references(() => ideas.id, { onDelete: "cascade" }),
    content: text("content").notNull().default(""),
    wordCount: integer("wordCount").notNull().default(0),
    characterCount: integer("characterCount").notNull().default(0),
    platform: text("platform", { enum: PLATFORMS }).notNull().default("both"),
    lastSavedAt: timestamp("lastSavedAt")
      .notNull()
      .default(sql`(unixepoch())`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  table => [uniqueIndex("drafts_ideaId_unique").on(table.ideaId)]
);

export type Draft = typeof drafts.$inferSelect;
export type InsertDraft = typeof drafts.$inferInsert;

/**
 * The capture layer: half-formed thoughts, dumped fast and sorted later.
 * A thought can be promoted into a full idea via `linkedIdeaId`.
 */
export const rawThoughts = sqliteTable(
  "rawThoughts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    /** JSON-encoded string array. */
    tags: text("tags"),
    linkedIdeaId: integer("linkedIdeaId").references(() => ideas.id, {
      onDelete: "set null",
    }),
    /** Soft delete, same reasoning as `ideas.deletedAt`. */
    deletedAt: timestamp("deletedAt"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  table => [index("rawThoughts_userId_idx").on(table.userId)]
);

export type RawThought = typeof rawThoughts.$inferSelect;
export type InsertRawThought = typeof rawThoughts.$inferInsert;

/**
 * Writing sessions power the streak and "last wrote N days ago" indicators.
 */
export const writingSessions = sqliteTable(
  "writingSessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ideaId: integer("ideaId").references(() => ideas.id, { onDelete: "set null" }),
    startedAt: timestamp("startedAt")
      .notNull()
      .default(sql`(unixepoch())`),
    endedAt: timestamp("endedAt"),
    wordsWritten: integer("wordsWritten").notNull().default(0),
    createdAt: createdAt(),
  },
  table => [index("writingSessions_userId_idx").on(table.userId)]
);

export type WritingSession = typeof writingSessions.$inferSelect;
export type InsertWritingSession = typeof writingSessions.$inferInsert;


/**
 * The prompt library behind Discover. A null `userId` marks a curated prompt
 * shared by everyone; a set one is a prompt the writer added themselves.
 */
export const prompts = sqliteTable(
  "prompts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("userId").references(() => users.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    /** Loose grouping — "reflection", "technical", "short". Not an enum, on purpose. */
    kind: text("kind").notNull().default("general"),
    createdAt: createdAt(),
  },
  table => [index("prompts_userId_idx").on(table.userId)]
);

export type Prompt = typeof prompts.$inferSelect;
export type InsertPrompt = typeof prompts.$inferInsert;
