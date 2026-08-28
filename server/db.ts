import Database from "better-sqlite3";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  drafts,
  ideas,
  prompts,
  research,
  userCategories,
  userPreferences,
  users,
  rawThoughts,
  writingSessions,
  type InsertIdea,
  type InsertRawThought,
  type PublicUser,
  type User,
} from "../drizzle/schema";
import { ENV, TRASH_RETENTION_MS } from "./_core/env";

export const schema = {
  users,
  ideas,
  research,
  userCategories,
  userPreferences,
  drafts,
  rawThoughts,
  writingSessions,
  prompts,
};

let cached: ReturnType<typeof createDb> | null = null;
let cachedRaw: Database.Database | null = null;

function createDb(file: string) {
  const absolute = path.resolve(file);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });

  const sqlite = new Database(absolute);
  // WAL gives us concurrent reads during writes; foreign keys are off by
  // default in SQLite and our cascades depend on them.
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  cachedRaw = sqlite;
  return drizzle(sqlite, { schema });
}

export function getDb() {
  if (!cached) {
    cached = createDb(ENV.databaseFile);
  }
  return cached;
}

/**
 * The underlying better-sqlite3 handle. Needed only by the migrator, which has
 * to toggle `foreign_keys` — a pragma SQLite silently ignores inside a
 * transaction, so it cannot be done through Drizzle.
 */
export function getRawDb(): Database.Database {
  getDb();
  return cachedRaw!;
}

/**
 * A user as the API returns it. Nothing on the row is secret now that there are
 * no password digests, so this is identity — kept as a named function so every
 * call site still passes through one place if that ever changes.
 */
export function toPublicUser(user: User): PublicUser {
  return user;
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export async function findUserByEmail(
  email: string
): Promise<User | undefined> {
  const rows = await getDb()
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase().trim()))
    .limit(1);
  return rows[0];
}

export async function findUserById(id: number): Promise<User | undefined> {
  const rows = await getDb()
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return rows[0];
}

export async function touchLastSignedIn(userId: number): Promise<void> {
  await getDb()
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, userId));
}

/** Case-insensitive, because `/@Khushi` and `/@khushi` are the same person. */
export async function findUserByUsername(
  username: string
): Promise<User | undefined> {
  const rows = await getDb()
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = ${username.toLowerCase().trim()}`)
    .limit(1);
  return rows[0];
}

export async function updateProfile(
  userId: number,
  updates: {
    name?: string | null;
    username?: string | null;
    bio?: string | null;
    publicProfile?: boolean;
  }
): Promise<User> {
  const [updated] = await getDb()
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

export async function findUserByGoogleId(
  googleId: string
): Promise<User | undefined> {
  const rows = await getDb()
    .select()
    .from(users)
    .where(eq(users.googleId, googleId))
    .limit(1);
  return rows[0];
}

/** Creates an account from a verified Google identity. */
export async function createGoogleUser(input: {
  email: string;
  googleId: string;
  name?: string | null;
  avatarUrl?: string | null;
}): Promise<User> {
  const [created] = await getDb()
    .insert(users)
    .values({
      email: input.email.toLowerCase().trim(),
      googleId: input.googleId,
      name: input.name ?? null,
      avatarUrl: input.avatarUrl ?? null,
      lastSignedIn: new Date(),
    })
    .returning();
  return created;
}

/**
 * Attaches a Google identity to an existing account — the "I signed up with a
 * password months ago and now clicked the Google button" case. Only ever called
 * after Google has confirmed it verified the address.
 */
export async function linkGoogleId(
  userId: number,
  googleId: string,
  avatarUrl?: string | null
): Promise<User> {
  const [updated] = await getDb()
    .update(users)
    .set({
      googleId,
      ...(avatarUrl ? { avatarUrl } : {}),
      lastSignedIn: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}

export async function createDemoUser(input: {
  email: string;
  name: string;
  expiresAt: Date;
}): Promise<User> {
  const [created] = await getDb()
    .insert(users)
    .values({
      email: input.email,
      name: input.name,
      demoExpiresAt: input.expiresAt,
      lastSignedIn: new Date(),
    })
    .returning();
  return created;
}

/** How many live sandboxes exist right now. */
export async function countLiveSandboxes(): Promise<number> {
  const rows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(
      and(isNotNull(users.demoExpiresAt), gt(users.demoExpiresAt, new Date()))
    );
  return rows.length;
}

/**
 * Deletes sandbox accounts past their expiry. Every table hanging off `users`
 * cascades, so this is the only cleanup needed.
 */
export async function purgeExpiredDemoUsers(): Promise<number> {
  const deleted = await getDb()
    .delete(users)
    .where(
      and(isNotNull(users.demoExpiresAt), lt(users.demoExpiresAt, new Date()))
    )
    .returning({ id: users.id });
  return deleted.length;
}

/**
 * Everything this account owns, for the "download my writing" step of account
 * deletion. Reads the tables directly rather than reusing the list helpers,
 * because those filter out soft-deleted rows and an export should include what
 * is sitting in the bin too — it is still the user's writing.
 */
export async function exportAccount(userId: number) {
  const db = getDb();
  const [
    account,
    allIdeas,
    allThoughts,
    allDrafts,
    categories,
    sessions,
    ownPrompts,
  ] = await Promise.all([
    findUserById(userId),
    db.select().from(ideas).where(eq(ideas.userId, userId)),
    db.select().from(rawThoughts).where(eq(rawThoughts.userId, userId)),
    db.select().from(drafts).where(eq(drafts.userId, userId)),
    db.select().from(userCategories).where(eq(userCategories.userId, userId)),
    db.select().from(writingSessions).where(eq(writingSessions.userId, userId)),
    db.select().from(prompts).where(eq(prompts.userId, userId)),
  ]);

  const draftByIdea = new Map(allDrafts.map(draft => [draft.ideaId, draft]));

  return {
    exportedAt: new Date().toISOString(),
    account: account
      ? {
          email: account.email,
          name: account.name,
          username: account.username,
          bio: account.bio,
          joined: account.createdAt,
        }
      : null,
    categories: categories.map(category => category.name),
    // Each idea carries its prose inline, so the file reads as the work itself
    // rather than as a database dump the user has to reassemble.
    ideas: allIdeas.map(idea => ({
      title: idea.title,
      description: idea.description,
      category: idea.category,
      status: idea.status,
      wordCount: idea.wordCount,
      publishedUrl: idea.publishedUrl,
      publishedIn: idea.publishedIn,
      publishedAt: idea.publishedAt,
      inBin: idea.deletedAt !== null,
      createdAt: idea.createdAt,
      content: draftByIdea.get(idea.id)?.content ?? "",
    })),
    thoughts: allThoughts.map(thought => ({
      content: thought.content,
      tags: thought.tags,
      inBin: thought.deletedAt !== null,
      createdAt: thought.createdAt,
    })),
    prompts: ownPrompts.map(prompt => prompt.text),
    writingDays: sessions.map(session => session.startedAt),
  };
}

/**
 * Deletes the account and everything hanging off it, for good.
 *
 * This is a real erasure, not the soft delete the bin uses — the row goes, and
 * every table referencing it cascades. Foreign keys are ON for normal
 * operation, so the cascade is what does the work here rather than something to
 * guard against.
 */
export async function deleteAccount(userId: number): Promise<boolean> {
  const deleted = await getDb()
    .delete(users)
    .where(eq(users.id, userId))
    .returning({ id: users.id });
  return deleted.length > 0;
}

// ---------------------------------------------------------------------------
// Ideas
// ---------------------------------------------------------------------------

/** Live ideas only — anything in the bin is excluded. */
export async function listIdeas(userId: number) {
  return getDb()
    .select()
    .from(ideas)
    .where(and(eq(ideas.userId, userId), isNull(ideas.deletedAt)))
    .orderBy(desc(ideas.updatedAt));
}

/** The shipped shelf: everything that actually went out, newest first. */
export async function listPublishedIdeas(userId: number) {
  return getDb()
    .select()
    .from(ideas)
    .where(
      and(
        eq(ideas.userId, userId),
        isNull(ideas.deletedAt),
        eq(ideas.status, "published"),
        isNotNull(ideas.publishedAt)
      )
    )
    .orderBy(desc(ideas.publishedAt));
}

export async function getIdea(ideaId: number, userId: number) {
  const rows = await getDb()
    .select()
    .from(ideas)
    .where(
      and(
        eq(ideas.id, ideaId),
        eq(ideas.userId, userId),
        isNull(ideas.deletedAt)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function createIdea(idea: InsertIdea) {
  const [created] = await getDb().insert(ideas).values(idea).returning();
  return created;
}

export async function updateIdea(
  ideaId: number,
  userId: number,
  updates: Partial<InsertIdea>
) {
  const [updated] = await getDb()
    .update(ideas)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(ideas.id, ideaId), eq(ideas.userId, userId)))
    .returning();
  return updated ?? null;
}

/** Moves an idea to the bin. Reversible until the bin is emptied. */
export async function softDeleteIdea(ideaId: number, userId: number) {
  const [deleted] = await getDb()
    .update(ideas)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(ideas.id, ideaId),
        eq(ideas.userId, userId),
        isNull(ideas.deletedAt)
      )
    )
    .returning({ id: ideas.id });
  return deleted ?? null;
}

export async function restoreIdea(ideaId: number, userId: number) {
  const [restored] = await getDb()
    .update(ideas)
    .set({ deletedAt: null })
    .where(and(eq(ideas.id, ideaId), eq(ideas.userId, userId)))
    .returning();
  return restored ?? null;
}

export async function listDeletedIdeas(userId: number) {
  return getDb()
    .select()
    .from(ideas)
    .where(and(eq(ideas.userId, userId), isNotNull(ideas.deletedAt)))
    .orderBy(desc(ideas.deletedAt));
}

/** Irreversible. Only reached from an explicit "delete forever" action. */
export async function deleteIdea(ideaId: number, userId: number) {
  const deleted = await getDb()
    .delete(ideas)
    .where(and(eq(ideas.id, ideaId), eq(ideas.userId, userId)))
    .returning({ id: ideas.id });
  return deleted.length > 0;
}

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

export async function listResearch(ideaId: number, userId: number) {
  return getDb()
    .select()
    .from(research)
    .where(and(eq(research.ideaId, ideaId), eq(research.userId, userId)))
    .orderBy(desc(research.createdAt));
}

export async function addResearch(data: {
  ideaId: number;
  userId: number;
  title: string;
  url?: string | null;
  notes?: string | null;
  source?: "article" | "paper" | "video" | "book" | "other";
}) {
  const [created] = await getDb().insert(research).values(data).returning();
  return created;
}

export async function deleteResearch(researchId: number, userId: number) {
  const deleted = await getDb()
    .delete(research)
    .where(and(eq(research.id, researchId), eq(research.userId, userId)))
    .returning({ id: research.id });
  return deleted.length > 0;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategories(userId: number) {
  return getDb()
    .select()
    .from(userCategories)
    .where(eq(userCategories.userId, userId))
    .orderBy(userCategories.sortOrder, userCategories.id);
}

export async function createCategory(data: {
  userId: number;
  name: string;
  description?: string | null;
  color?: string | null;
  sortOrder?: number;
}) {
  const [created] = await getDb()
    .insert(userCategories)
    .values(data)
    .onConflictDoNothing()
    .returning();
  return created ?? null;
}

export async function updateCategory(
  categoryId: number,
  userId: number,
  updates: { name?: string; description?: string | null; color?: string | null }
) {
  const [updated] = await getDb()
    .update(userCategories)
    .set(updates)
    .where(
      and(eq(userCategories.id, categoryId), eq(userCategories.userId, userId))
    )
    .returning();
  return updated ?? null;
}

export async function deleteCategory(categoryId: number, userId: number) {
  const deleted = await getDb()
    .delete(userCategories)
    .where(
      and(eq(userCategories.id, categoryId), eq(userCategories.userId, userId))
    )
    .returning({ id: userCategories.id });
  return deleted.length > 0;
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

export async function getPreferences(userId: number) {
  const rows = await getDb()
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  if (rows[0]) return rows[0];

  const [created] = await getDb()
    .insert(userPreferences)
    .values({ userId })
    .returning();
  return created;
}

export async function updatePreferences(
  userId: number,
  updates: {
    defaultPlatform?: "substack" | "medium" | "both";
    onboardingCompleted?: boolean;
    dailyWordGoal?: number;
  }
) {
  await getPreferences(userId); // ensure the row exists
  const [updated] = await getDb()
    .update(userPreferences)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(userPreferences.userId, userId))
    .returning();
  return updated;
}

// ---------------------------------------------------------------------------
// Drafts
// ---------------------------------------------------------------------------

export async function getDraftByIdeaId(ideaId: number, userId: number) {
  const rows = await getDb()
    .select()
    .from(drafts)
    .where(and(eq(drafts.ideaId, ideaId), eq(drafts.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listDrafts(userId: number) {
  return getDb()
    .select()
    .from(drafts)
    .where(eq(drafts.userId, userId))
    .orderBy(desc(drafts.lastSavedAt));
}

/**
 * Upsert keyed on `ideaId` (unique), so the editor's autosave can fire freely
 * without racing itself into duplicate rows.
 */
export async function saveDraft(data: {
  userId: number;
  ideaId: number;
  content: string;
  wordCount: number;
  characterCount: number;
  platform?: "substack" | "medium" | "both";
}) {
  const now = new Date();
  const [saved] = await getDb()
    .insert(drafts)
    .values({ ...data, lastSavedAt: now })
    .onConflictDoUpdate({
      target: drafts.ideaId,
      set: {
        content: data.content,
        wordCount: data.wordCount,
        characterCount: data.characterCount,
        ...(data.platform ? { platform: data.platform } : {}),
        lastSavedAt: now,
        updatedAt: now,
      },
    })
    .returning();

  // Keep the idea's word count in step so dashboard totals stay honest.
  await getDb()
    .update(ideas)
    .set({ wordCount: data.wordCount, updatedAt: now })
    .where(and(eq(ideas.id, data.ideaId), eq(ideas.userId, data.userId)));

  return saved;
}

export async function deleteDraft(draftId: number, userId: number) {
  const deleted = await getDb()
    .delete(drafts)
    .where(and(eq(drafts.id, draftId), eq(drafts.userId, userId)))
    .returning({ id: drafts.id });
  return deleted.length > 0;
}

// ---------------------------------------------------------------------------
// Raw thoughts (the capture layer)
// ---------------------------------------------------------------------------

export async function listThoughts(userId: number) {
  return getDb()
    .select()
    .from(rawThoughts)
    .where(and(eq(rawThoughts.userId, userId), isNull(rawThoughts.deletedAt)))
    .orderBy(desc(rawThoughts.createdAt));
}

/** The thoughts feeding one idea — shown in the editor's side rail. */
export async function listThoughtsForIdea(ideaId: number, userId: number) {
  return getDb()
    .select()
    .from(rawThoughts)
    .where(
      and(
        eq(rawThoughts.userId, userId),
        eq(rawThoughts.linkedIdeaId, ideaId),
        isNull(rawThoughts.deletedAt)
      )
    )
    .orderBy(asc(rawThoughts.createdAt));
}

/** Thoughts not yet attached to anything — candidates for merging. */
export async function listUnlinkedThoughts(userId: number) {
  return getDb()
    .select()
    .from(rawThoughts)
    .where(
      and(
        eq(rawThoughts.userId, userId),
        isNull(rawThoughts.linkedIdeaId),
        isNull(rawThoughts.deletedAt)
      )
    )
    .orderBy(desc(rawThoughts.createdAt));
}

/**
 * Points a batch of thoughts at one idea. Scoped by `userId` in the same
 * statement so an id from another account simply matches nothing.
 */
export async function linkThoughtsToIdea(
  thoughtIds: number[],
  ideaId: number | null,
  userId: number
): Promise<number> {
  if (thoughtIds.length === 0) return 0;
  const updated = await getDb()
    .update(rawThoughts)
    .set({ linkedIdeaId: ideaId, updatedAt: new Date() })
    .where(
      and(
        eq(rawThoughts.userId, userId),
        inArray(rawThoughts.id, thoughtIds),
        isNull(rawThoughts.deletedAt)
      )
    )
    .returning({ id: rawThoughts.id });
  return updated.length;
}

export async function getThoughtsByIds(thoughtIds: number[], userId: number) {
  if (thoughtIds.length === 0) return [];
  return getDb()
    .select()
    .from(rawThoughts)
    .where(
      and(
        eq(rawThoughts.userId, userId),
        inArray(rawThoughts.id, thoughtIds),
        isNull(rawThoughts.deletedAt)
      )
    )
    .orderBy(asc(rawThoughts.createdAt));
}

export async function createThought(data: InsertRawThought) {
  const [created] = await getDb().insert(rawThoughts).values(data).returning();
  return created;
}

export async function updateThought(
  thoughtId: number,
  userId: number,
  updates: {
    content?: string;
    tags?: string | null;
    linkedIdeaId?: number | null;
  }
) {
  const [updated] = await getDb()
    .update(rawThoughts)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(rawThoughts.id, thoughtId), eq(rawThoughts.userId, userId)))
    .returning();
  return updated ?? null;
}

export async function softDeleteThought(thoughtId: number, userId: number) {
  const [deleted] = await getDb()
    .update(rawThoughts)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(rawThoughts.id, thoughtId),
        eq(rawThoughts.userId, userId),
        isNull(rawThoughts.deletedAt)
      )
    )
    .returning({ id: rawThoughts.id });
  return deleted ?? null;
}

export async function restoreThought(thoughtId: number, userId: number) {
  const [restored] = await getDb()
    .update(rawThoughts)
    .set({ deletedAt: null })
    .where(and(eq(rawThoughts.id, thoughtId), eq(rawThoughts.userId, userId)))
    .returning();
  return restored ?? null;
}

export async function listDeletedThoughts(userId: number) {
  return getDb()
    .select()
    .from(rawThoughts)
    .where(
      and(eq(rawThoughts.userId, userId), isNotNull(rawThoughts.deletedAt))
    )
    .orderBy(desc(rawThoughts.deletedAt));
}

/** Irreversible. Only reached from an explicit "delete forever" action. */
export async function deleteThought(thoughtId: number, userId: number) {
  const deleted = await getDb()
    .delete(rawThoughts)
    .where(and(eq(rawThoughts.id, thoughtId), eq(rawThoughts.userId, userId)))
    .returning({ id: rawThoughts.id });
  return deleted.length > 0;
}

/**
 * Empties the bin: purges rows the user explicitly discarded, plus anything
 * that has sat in the bin past the retention window.
 */
export async function purgeTrash(
  userId: number,
  olderThan?: Date
): Promise<number> {
  const cutoff = olderThan ?? new Date();
  const [purgedIdeas, purgedThoughts] = await Promise.all([
    getDb()
      .delete(ideas)
      .where(
        and(
          eq(ideas.userId, userId),
          isNotNull(ideas.deletedAt),
          lt(ideas.deletedAt, cutoff)
        )
      )
      .returning({ id: ideas.id }),
    getDb()
      .delete(rawThoughts)
      .where(
        and(
          eq(rawThoughts.userId, userId),
          isNotNull(rawThoughts.deletedAt),
          lt(rawThoughts.deletedAt, cutoff)
        )
      )
      .returning({ id: rawThoughts.id }),
  ]);
  return purgedIdeas.length + purgedThoughts.length;
}

/** Sweeps expired trash for every account. Runs once at startup. */
export async function purgeExpiredTrash(): Promise<number> {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_MS);
  const [purgedIdeas, purgedThoughts] = await Promise.all([
    getDb()
      .delete(ideas)
      .where(and(isNotNull(ideas.deletedAt), lt(ideas.deletedAt, cutoff)))
      .returning({ id: ideas.id }),
    getDb()
      .delete(rawThoughts)
      .where(
        and(isNotNull(rawThoughts.deletedAt), lt(rawThoughts.deletedAt, cutoff))
      )
      .returning({ id: rawThoughts.id }),
  ]);
  return purgedIdeas.length + purgedThoughts.length;
}

// ---------------------------------------------------------------------------
// Writing activity
// ---------------------------------------------------------------------------

/**
 * Records that words were actually written.
 *
 * `wordsWritten` is the delta against the previous save, not the size of the
 * document — otherwise opening a 2,000-word draft and fixing a typo would log
 * 2,000 words and every autosave would inflate the total. A save that adds
 * nothing (a deletion, a reformat, an idle autosave) logs no session at all,
 * so the streak means "I wrote", not "I opened the app".
 */
export async function recordWritingActivity(
  userId: number,
  ideaId: number,
  wordsAdded: number
) {
  if (wordsAdded <= 0) return null;

  const [created] = await getDb()
    .insert(writingSessions)
    .values({ userId, ideaId, wordsWritten: wordsAdded, endedAt: new Date() })
    .returning();
  return created;
}

// ---------------------------------------------------------------------------
// Prompts (the Discover library)
// ---------------------------------------------------------------------------

/**
 * The curated library plus this user's own additions, in one list. Curated
 * rows have a null `userId` and are shared by every account.
 */
export async function listPrompts(userId: number) {
  return getDb()
    .select()
    .from(prompts)
    .where(or(isNull(prompts.userId), eq(prompts.userId, userId)))
    .orderBy(asc(prompts.id));
}

export async function createPrompt(data: {
  userId: number;
  text: string;
  kind?: string;
}) {
  const [created] = await getDb()
    .insert(prompts)
    .values({
      userId: data.userId,
      text: data.text,
      kind: data.kind ?? "general",
    })
    .returning();
  return created;
}

/** Scoped to `userId`, so curated prompts can never be deleted by a user. */
export async function deletePrompt(promptId: number, userId: number) {
  const deleted = await getDb()
    .delete(prompts)
    .where(and(eq(prompts.id, promptId), eq(prompts.userId, userId)))
    .returning({ id: prompts.id });
  return deleted.length > 0;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export type SearchHit = {
  kind: "idea" | "thought" | "draft";
  id: number;
  /** Where to navigate on click. */
  ideaId: number | null;
  title: string;
  excerpt: string;
  updatedAt: Date;
};

/**
 * Substring search across ideas, thoughts, and draft prose.
 *
 * `like` on a few hundred rows is instant and needs no index maintenance;
 * if a user ever has enough writing for this to drag, SQLite's FTS5 is the
 * upgrade path and this function is the only thing that changes.
 */
export async function search(
  userId: number,
  term: string
): Promise<SearchHit[]> {
  const trimmed = term.trim();
  if (trimmed.length === 0) return [];

  // Escape LIKE wildcards so a literal % or _ searches for itself.
  const pattern = `%${trimmed.replace(/[\\%_]/g, character => `\\${character}`)}%`;
  const matches = (column: unknown) =>
    sql`${column} LIKE ${pattern} ESCAPE '\\'`;

  const [ideaRows, thoughtRows, draftRows] = await Promise.all([
    getDb()
      .select()
      .from(ideas)
      .where(
        and(
          eq(ideas.userId, userId),
          isNull(ideas.deletedAt),
          or(matches(ideas.title), matches(ideas.description))
        )
      )
      .orderBy(desc(ideas.updatedAt))
      .limit(20),
    getDb()
      .select()
      .from(rawThoughts)
      .where(
        and(
          eq(rawThoughts.userId, userId),
          isNull(rawThoughts.deletedAt),
          matches(rawThoughts.content)
        )
      )
      .orderBy(desc(rawThoughts.createdAt))
      .limit(20),
    getDb()
      .select({
        id: drafts.id,
        ideaId: drafts.ideaId,
        content: drafts.content,
        updatedAt: drafts.updatedAt,
        title: ideas.title,
      })
      .from(drafts)
      .innerJoin(ideas, eq(drafts.ideaId, ideas.id))
      .where(
        and(
          eq(drafts.userId, userId),
          isNull(ideas.deletedAt),
          matches(drafts.content)
        )
      )
      .orderBy(desc(drafts.lastSavedAt))
      .limit(20),
  ]);

  return [
    ...ideaRows.map((idea): SearchHit => ({
      kind: "idea",
      id: idea.id,
      ideaId: idea.id,
      title: idea.title,
      excerpt: idea.description ?? "",
      updatedAt: idea.updatedAt,
    })),
    ...thoughtRows.map((thought): SearchHit => ({
      kind: "thought",
      id: thought.id,
      ideaId: thought.linkedIdeaId,
      title: "Thought",
      excerpt: excerptAround(thought.content, trimmed),
      updatedAt: thought.updatedAt,
    })),
    ...draftRows.map((draft): SearchHit => ({
      kind: "draft",
      id: draft.id,
      ideaId: draft.ideaId,
      title: draft.title,
      excerpt: excerptAround(draft.content, trimmed),
      updatedAt: draft.updatedAt,
    })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

/** A window of text around the first match, so results show why they matched. */
function excerptAround(content: string, term: string, radius = 90): string {
  const index = content.toLowerCase().indexOf(term.toLowerCase());
  if (index === -1) return content.slice(0, radius * 2);

  const start = Math.max(0, index - radius);
  const end = Math.min(content.length, index + term.length + radius);
  return `${start > 0 ? "…" : ""}${content.slice(start, end)}${end < content.length ? "…" : ""}`;
}

/**
 * Raw start times of every writing session. Deliberately not grouped into days
 * here: SQLite's `localtime` uses the *server's* timezone, which is meaningless
 * for a user somewhere else. The caller buckets these in the viewer's zone.
 */
export async function listWritingSessionTimes(
  userId: number
): Promise<{ startedAt: Date; wordsWritten: number }[]> {
  return getDb()
    .select({
      startedAt: writingSessions.startedAt,
      wordsWritten: writingSessions.wordsWritten,
    })
    .from(writingSessions)
    .where(eq(writingSessions.userId, userId));
}
