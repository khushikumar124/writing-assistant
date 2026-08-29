// GENERATED from server/serverless.ts by 'npm run build:function'. Committed because Vercel looks for api/index.js before running the build. Do not edit.
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/_core/env.ts
import crypto from "node:crypto";
function resolveSessionSecret() {
  const configured2 = process.env.SESSION_SECRET?.trim();
  if (configured2) return configured2;
  if (isProduction) {
    throw new Error(
      "SESSION_SECRET is required in production. Generate one with: openssl rand -base64 32"
    );
  }
  console.warn(
    "[env] SESSION_SECRET not set \u2014 using a random development secret. Sessions will not survive a restart."
  );
  return crypto.randomBytes(32).toString("base64");
}
function resolveDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Create a free Postgres database at neon.com and put its pooled connection string in .env"
    );
  }
  return url;
}
var isProduction, ENV, googleEnabled, DEMO_TTL_MS, TRASH_RETENTION_MS;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    isProduction = process.env.NODE_ENV === "production";
    ENV = {
      isProduction,
      port: Number.parseInt(process.env.PORT ?? "3000", 10),
      /**
       * Postgres connection string. Required everywhere — there is no local file
       * fallback, because silently writing to a different database than production
       * is a worse failure than refusing to start.
       */
      databaseUrl: resolveDatabaseUrl(),
      sessionSecret: resolveSessionSecret(),
      /**
       * Enables the "Try it without an account" button. Each click mints a private,
       * throwaway sandbox account — there is no shared demo login to hijack.
       */
      demoMode: process.env.DEMO_MODE !== "false",
      /** Absolute base URL. Used to build the OAuth redirect URI. */
      appUrl: (process.env.APP_URL ?? `http://localhost:${process.env.PORT ?? "3000"}`).replace(/\/$/, ""),
      /**
       * Google sign-in turns itself on only when both halves are present, so a
       * deploy without them simply shows email/password and nothing breaks.
       */
      googleClientId: process.env.GOOGLE_CLIENT_ID?.trim() || null,
      googleClientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || null,
      /**
       * Web Push signing keys. Generate a pair with `npm run keys:vapid`. Without
       * them the reminder settings hide themselves and nothing is scheduled.
       */
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY?.trim() || null,
      vapidPrivateKey: process.env.VAPID_PRIVATE_KEY?.trim() || null,
      /** Contact address push services can use to reach the operator. */
      vapidSubject: process.env.VAPID_SUBJECT?.trim() || "mailto:hello@example.com",
      /**
       * Shared secret the platform's scheduler presents when calling /api/cron/*.
       * Vercel sets this header automatically when the variable is configured.
       */
      cronSecret: process.env.CRON_SECRET?.trim() || null
    };
    googleEnabled = () => Boolean(ENV.googleClientId && ENV.googleClientSecret);
    DEMO_TTL_MS = 1e3 * 60 * 60 * 24;
    TRASH_RETENTION_MS = 1e3 * 60 * 60 * 24 * 30;
  }
});

// server/_core/observability.ts
function clamp(value, max) {
  if (typeof value !== "string") return void 0;
  const trimmed = value.trim();
  if (!trimmed) return void 0;
  return trimmed.slice(0, max);
}
function report(record) {
  console.error(
    JSON.stringify({
      level: "error",
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      ...record
    })
  );
}
function mountErrorReporting(app2) {
  const seen = /* @__PURE__ */ new Map();
  const WINDOW_MS = 6e4;
  const MAX_PER_WINDOW = 20;
  app2.post("/api/errors", (req, res) => {
    const ip = req.ip ?? "unknown";
    const now = Date.now();
    const count2 = (seen.get(ip) ?? 0) + 1;
    seen.set(ip, count2);
    if (seen.size > 2e3) seen.clear();
    setTimeout(() => seen.delete(ip), WINDOW_MS).unref?.();
    if (count2 > MAX_PER_WINDOW) {
      res.status(429).end();
      return;
    }
    const body = req.body ?? {};
    report({
      source: "client",
      message: clamp(body.message, 500) ?? "Unknown client error",
      stack: clamp(body.stack, 4e3),
      at: clamp(body.at, 500),
      userAgent: clamp(req.headers["user-agent"], 300)
    });
    res.status(204).end();
  });
  if (!ENV.isProduction) {
    console.log("  Error reporting \u2192 POST /api/errors (logged to stderr)");
  }
}
var init_observability = __esm({
  "server/_core/observability.ts"() {
    "use strict";
    init_env();
  }
});

// shared/const.ts
var COOKIE_NAME, SESSION_TTL_MS, UNAUTHED_ERR_MSG, NOT_ADMIN_ERR_MSG;
var init_const = __esm({
  "shared/const.ts"() {
    "use strict";
    COOKIE_NAME = "writing_assistant_session";
    SESSION_TTL_MS = 1e3 * 60 * 60 * 24 * 30;
    UNAUTHED_ERR_MSG = "You need to sign in to do that.";
    NOT_ADMIN_ERR_MSG = "You do not have permission to do that.";
  }
});

// shared/domain.ts
var PLATFORMS, IDEA_STATUSES, RESEARCH_SOURCES, USER_ROLES, REMINDER_FREQUENCIES;
var init_domain = __esm({
  "shared/domain.ts"() {
    "use strict";
    PLATFORMS = ["substack", "medium", "both"];
    IDEA_STATUSES = [
      "draft",
      "outline",
      "in-progress",
      "completed",
      "published"
    ];
    RESEARCH_SOURCES = [
      "article",
      "paper",
      "video",
      "book",
      "other"
    ];
    USER_ROLES = ["user", "admin"];
    REMINDER_FREQUENCIES = [
      "off",
      "daily",
      "weekly",
      "monthly",
      "custom"
    ];
  }
});

// drizzle/schema.ts
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp as pgTimestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";
var timestamp, createdAt, updatedAt, users, ideas, research, userCategories, userPreferences, drafts, rawThoughts, writingSessions, prompts, pushSubscriptions;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    init_domain();
    init_domain();
    timestamp = (name) => pgTimestamp(name, { withTimezone: true });
    createdAt = () => timestamp("createdAt").notNull().defaultNow();
    updatedAt = () => timestamp("updatedAt").notNull().defaultNow();
    users = pgTable(
      "users",
      {
        id: serial("id").primaryKey(),
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
        publicProfile: boolean("publicProfile").notNull().default(false),
        bio: text("bio"),
        /**
         * Set on throwaway sandbox accounts handed out by the demo button. A row
         * with a past `demoExpiresAt` is garbage and gets purged.
         */
        demoExpiresAt: timestamp("demoExpiresAt"),
        createdAt: createdAt(),
        updatedAt: updatedAt(),
        lastSignedIn: timestamp("lastSignedIn")
      },
      (table) => [
        uniqueIndex("users_email_unique").on(table.email),
        uniqueIndex("users_username_unique").on(table.username),
        uniqueIndex("users_googleId_unique").on(table.googleId)
      ]
    );
    ideas = pgTable(
      "ideas",
      {
        id: serial("id").primaryKey(),
        userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
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
        /**
         * Archived: out of the way but not on its way out. Distinct from
         * `deletedAt` because the bin empties itself after 30 days and this never
         * does — a piece you have set aside should still be there next year.
         */
        archivedAt: timestamp("archivedAt"),
        createdAt: createdAt(),
        updatedAt: updatedAt()
      },
      (table) => [index("ideas_userId_idx").on(table.userId)]
    );
    research = pgTable(
      "research",
      {
        id: serial("id").primaryKey(),
        ideaId: integer("ideaId").notNull().references(() => ideas.id, { onDelete: "cascade" }),
        userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
        title: text("title").notNull(),
        url: text("url"),
        notes: text("notes"),
        source: text("source", { enum: RESEARCH_SOURCES }).default("other"),
        createdAt: createdAt()
      },
      (table) => [index("research_ideaId_idx").on(table.ideaId)]
    );
    userCategories = pgTable(
      "userCategories",
      {
        id: serial("id").primaryKey(),
        userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
        name: text("name").notNull(),
        description: text("description"),
        /** Hex colour, e.g. `#0d5f5f`. */
        color: text("color"),
        sortOrder: integer("sortOrder").notNull().default(0),
        createdAt: createdAt()
      },
      (table) => [
        uniqueIndex("userCategories_user_name_unique").on(table.userId, table.name)
      ]
    );
    userPreferences = pgTable("userPreferences", {
      id: serial("id").primaryKey(),
      userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
      defaultPlatform: text("defaultPlatform", { enum: PLATFORMS }).notNull().default("both"),
      onboardingCompleted: boolean("onboardingCompleted").notNull().default(false),
      /**
       * A daily words target. 0 means "not set", which is the default — a goal
       * should be something you opt into, not a number the app assigns you.
       */
      dailyWordGoal: integer("dailyWordGoal").notNull().default(0),
      /** How often to nudge. "off" unless the user asks for reminders. */
      reminderFrequency: text("reminderFrequency", { enum: REMINDER_FREQUENCIES }).notNull().default("off"),
      /** Local wall-clock time to send at, "HH:MM". */
      reminderTime: text("reminderTime").notNull().default("09:00"),
      /** JSON array of weekday numbers (0=Sunday) for the custom schedule. */
      reminderDays: text("reminderDays"),
      /** The user's IANA zone, so a 9am reminder is 9am where they are. */
      timeZone: text("timeZone").notNull().default("UTC"),
      /** Guards against sending twice for the same window after a restart. */
      lastRemindedAt: timestamp("lastRemindedAt"),
      createdAt: createdAt(),
      updatedAt: updatedAt()
    });
    drafts = pgTable(
      "drafts",
      {
        id: serial("id").primaryKey(),
        userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
        ideaId: integer("ideaId").notNull().references(() => ideas.id, { onDelete: "cascade" }),
        content: text("content").notNull().default(""),
        wordCount: integer("wordCount").notNull().default(0),
        characterCount: integer("characterCount").notNull().default(0),
        platform: text("platform", { enum: PLATFORMS }).notNull().default("both"),
        lastSavedAt: timestamp("lastSavedAt").notNull().defaultNow(),
        createdAt: createdAt(),
        updatedAt: updatedAt()
      },
      (table) => [uniqueIndex("drafts_ideaId_unique").on(table.ideaId)]
    );
    rawThoughts = pgTable(
      "rawThoughts",
      {
        id: serial("id").primaryKey(),
        userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
        content: text("content").notNull(),
        /** JSON-encoded string array. */
        tags: text("tags"),
        linkedIdeaId: integer("linkedIdeaId").references(() => ideas.id, {
          onDelete: "set null"
        }),
        /** Soft delete, same reasoning as `ideas.deletedAt`. */
        deletedAt: timestamp("deletedAt"),
        /** Archived, same reasoning as `ideas.archivedAt`. */
        archivedAt: timestamp("archivedAt"),
        createdAt: createdAt(),
        updatedAt: updatedAt()
      },
      (table) => [index("rawThoughts_userId_idx").on(table.userId)]
    );
    writingSessions = pgTable(
      "writingSessions",
      {
        id: serial("id").primaryKey(),
        userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
        ideaId: integer("ideaId").references(() => ideas.id, {
          onDelete: "set null"
        }),
        startedAt: timestamp("startedAt").notNull().defaultNow(),
        endedAt: timestamp("endedAt"),
        wordsWritten: integer("wordsWritten").notNull().default(0),
        createdAt: createdAt()
      },
      (table) => [index("writingSessions_userId_idx").on(table.userId)]
    );
    prompts = pgTable(
      "prompts",
      {
        id: serial("id").primaryKey(),
        userId: integer("userId").references(() => users.id, {
          onDelete: "cascade"
        }),
        text: text("text").notNull(),
        /** Loose grouping — "reflection", "technical", "short". Not an enum, on purpose. */
        kind: text("kind").notNull().default("general"),
        createdAt: createdAt()
      },
      (table) => [index("prompts_userId_idx").on(table.userId)]
    );
    pushSubscriptions = pgTable(
      "pushSubscriptions",
      {
        id: serial("id").primaryKey(),
        userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
        /** The push service URL. Unique: one row per browser install. */
        endpoint: text("endpoint").notNull(),
        p256dh: text("p256dh").notNull(),
        auth: text("auth").notNull(),
        /** Consecutive delivery failures; a dead endpoint gets pruned. */
        failureCount: integer("failureCount").notNull().default(0),
        createdAt: createdAt()
      },
      (table) => [
        uniqueIndex("pushSubscriptions_endpoint_unique").on(table.endpoint),
        index("pushSubscriptions_userId_idx").on(table.userId)
      ]
    );
  }
});

// shared/search.ts
function fieldScore(haystack, needle, inTitle) {
  if (!haystack) return 0;
  const text2 = haystack.toLowerCase();
  const term = needle.toLowerCase();
  const index2 = text2.indexOf(term);
  if (index2 === -1) return 0;
  const wordBoundary = new RegExp(`\\b${escapeRegExp(term)}\\b`).test(text2);
  if (inTitle) {
    if (text2 === term) return FIELD_WEIGHT.titleExact;
    if (index2 === 0) return FIELD_WEIGHT.titleStart;
    return wordBoundary ? FIELD_WEIGHT.titleWord : FIELD_WEIGHT.titlePartial;
  }
  return wordBoundary ? FIELD_WEIGHT.bodyWord : FIELD_WEIGHT.bodyPartial;
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function recencyBoost(updatedAt2, now) {
  const days = (now.getTime() - updatedAt2.getTime()) / 864e5;
  if (days <= 0) return 1.25;
  return 1 + 0.25 * Math.exp(-days / 60);
}
function scoreMatch(item, query, now = /* @__PURE__ */ new Date()) {
  const trimmed = query.trim();
  if (!trimmed) return 0;
  const words = trimmed.split(/\s+/).filter((word) => word.length > 1);
  const terms = words.length > 0 ? words : [trimmed];
  let score = 0;
  for (const term of terms) {
    score += fieldScore(item.title, term, true);
    score += fieldScore(item.body, term, false);
  }
  if (terms.length > 1) {
    score += fieldScore(item.title, trimmed, true) * 1.5;
    score += fieldScore(item.body, trimmed, false) * 1.5;
  }
  if (score === 0) return 0;
  const kindWeight = item.kind === "idea" ? 1.15 : item.kind === "draft" ? 1.05 : 1;
  return score * kindWeight * recencyBoost(item.updatedAt, now);
}
var FIELD_WEIGHT;
var init_search = __esm({
  "shared/search.ts"() {
    "use strict";
    FIELD_WEIGHT = {
      /** A title match is the strongest signal there is. */
      titleExact: 100,
      titleStart: 60,
      titleWord: 45,
      titlePartial: 25,
      bodyWord: 12,
      bodyPartial: 5
    };
  }
});

// server/db.ts
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
function createClient() {
  return postgres(ENV.databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    /**
     * Hosted Postgres requires TLS; a local container has none. Decided from
     * the connection string so the same code runs in both without a flag.
     */
    ssl: /sslmode=require|neon\.tech|supabase|amazonaws/.test(ENV.databaseUrl) ? "require" : false
  });
}
function getClient() {
  if (!cachedClient) cachedClient = createClient();
  return cachedClient;
}
function getDb() {
  if (!cached) cached = drizzle(getClient(), { schema });
  return cached;
}
function toPublicUser(user) {
  return user;
}
async function findUserByEmail(email) {
  const rows = await getDb().select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
  return rows[0];
}
async function findUserById(id) {
  const rows = await getDb().select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0];
}
async function touchLastSignedIn(userId) {
  await getDb().update(users).set({ lastSignedIn: /* @__PURE__ */ new Date() }).where(eq(users.id, userId));
}
async function findUserByUsername(username2) {
  const rows = await getDb().select().from(users).where(sql`lower(${users.username}) = ${username2.toLowerCase().trim()}`).limit(1);
  return rows[0];
}
async function updateProfile(userId, updates) {
  const [updated] = await getDb().update(users).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, userId)).returning();
  return updated;
}
async function findUserByGoogleId(googleId) {
  const rows = await getDb().select().from(users).where(eq(users.googleId, googleId)).limit(1);
  return rows[0];
}
async function createGoogleUser(input) {
  const [created] = await getDb().insert(users).values({
    email: input.email.toLowerCase().trim(),
    googleId: input.googleId,
    name: input.name ?? null,
    avatarUrl: input.avatarUrl ?? null,
    lastSignedIn: /* @__PURE__ */ new Date()
  }).returning();
  return created;
}
async function linkGoogleId(userId, googleId, avatarUrl) {
  const [updated] = await getDb().update(users).set({
    googleId,
    ...avatarUrl ? { avatarUrl } : {},
    lastSignedIn: /* @__PURE__ */ new Date(),
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq(users.id, userId)).returning();
  return updated;
}
async function createDemoUser(input) {
  const [created] = await getDb().insert(users).values({
    email: input.email,
    name: input.name,
    demoExpiresAt: input.expiresAt,
    lastSignedIn: /* @__PURE__ */ new Date()
  }).returning();
  return created;
}
async function countLiveSandboxes() {
  const rows = await getDb().select({ id: users.id }).from(users).where(
    and(isNotNull(users.demoExpiresAt), gt(users.demoExpiresAt, /* @__PURE__ */ new Date()))
  );
  return rows.length;
}
async function purgeExpiredDemoUsers() {
  const deleted = await getDb().delete(users).where(
    and(isNotNull(users.demoExpiresAt), lt(users.demoExpiresAt, /* @__PURE__ */ new Date()))
  ).returning({ id: users.id });
  return deleted.length;
}
async function exportAccount(userId) {
  const db = getDb();
  const [
    account,
    allIdeas,
    allThoughts,
    allDrafts,
    categories,
    sessions,
    ownPrompts
  ] = await Promise.all([
    findUserById(userId),
    db.select().from(ideas).where(eq(ideas.userId, userId)),
    db.select().from(rawThoughts).where(eq(rawThoughts.userId, userId)),
    db.select().from(drafts).where(eq(drafts.userId, userId)),
    db.select().from(userCategories).where(eq(userCategories.userId, userId)),
    db.select().from(writingSessions).where(eq(writingSessions.userId, userId)),
    db.select().from(prompts).where(eq(prompts.userId, userId))
  ]);
  const draftByIdea = new Map(allDrafts.map((draft) => [draft.ideaId, draft]));
  return {
    exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
    account: account ? {
      email: account.email,
      name: account.name,
      username: account.username,
      bio: account.bio,
      joined: account.createdAt
    } : null,
    categories: categories.map((category) => category.name),
    // Each idea carries its prose inline, so the file reads as the work itself
    // rather than as a database dump the user has to reassemble.
    ideas: allIdeas.map((idea) => ({
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
      content: draftByIdea.get(idea.id)?.content ?? ""
    })),
    thoughts: allThoughts.map((thought) => ({
      content: thought.content,
      tags: thought.tags,
      inBin: thought.deletedAt !== null,
      createdAt: thought.createdAt
    })),
    prompts: ownPrompts.map((prompt) => prompt.text),
    writingDays: sessions.map((session) => session.startedAt)
  };
}
async function deleteAccount(userId) {
  const deleted = await getDb().delete(users).where(eq(users.id, userId)).returning({ id: users.id });
  return deleted.length > 0;
}
async function savePushSubscription(input) {
  const [saved] = await getDb().insert(pushSubscriptions).values(input).onConflictDoUpdate({
    target: pushSubscriptions.endpoint,
    set: {
      userId: input.userId,
      p256dh: input.p256dh,
      auth: input.auth,
      failureCount: 0
    }
  }).returning();
  return saved;
}
async function deletePushSubscription(endpoint) {
  await getDb().delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
async function listPushSubscriptions(userId) {
  return getDb().select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}
async function countPushSubscriptions(userId) {
  return (await listPushSubscriptions(userId)).length;
}
async function listReminderCandidates() {
  return getDb().select({
    userId: userPreferences.userId,
    frequency: userPreferences.reminderFrequency,
    time: userPreferences.reminderTime,
    days: userPreferences.reminderDays,
    timeZone: userPreferences.timeZone,
    lastRemindedAt: userPreferences.lastRemindedAt
  }).from(userPreferences).innerJoin(users, eq(users.id, userPreferences.userId)).where(
    and(
      isNull(users.demoExpiresAt),
      sql`${userPreferences.reminderFrequency} != 'off'`
    )
  );
}
async function markReminded(userId) {
  await getDb().update(userPreferences).set({ lastRemindedAt: /* @__PURE__ */ new Date(), updatedAt: /* @__PURE__ */ new Date() }).where(eq(userPreferences.userId, userId));
}
async function listIdeas(userId) {
  return getDb().select().from(ideas).where(
    and(
      eq(ideas.userId, userId),
      isNull(ideas.deletedAt),
      isNull(ideas.archivedAt)
    )
  ).orderBy(desc(ideas.updatedAt));
}
async function listArchivedIdeas(userId) {
  return getDb().select().from(ideas).where(
    and(
      eq(ideas.userId, userId),
      isNull(ideas.deletedAt),
      isNotNull(ideas.archivedAt)
    )
  ).orderBy(desc(ideas.archivedAt));
}
async function setIdeaArchived(ideaId, userId, archived) {
  const [row] = await getDb().update(ideas).set({ archivedAt: archived ? /* @__PURE__ */ new Date() : null }).where(
    and(
      eq(ideas.id, ideaId),
      eq(ideas.userId, userId),
      isNull(ideas.deletedAt)
    )
  ).returning({ id: ideas.id });
  return row ?? null;
}
async function listPublishedIdeas(userId) {
  return getDb().select().from(ideas).where(
    and(
      eq(ideas.userId, userId),
      isNull(ideas.deletedAt),
      eq(ideas.status, "published"),
      isNotNull(ideas.publishedAt)
    )
  ).orderBy(desc(ideas.publishedAt));
}
async function getIdea(ideaId, userId) {
  const rows = await getDb().select().from(ideas).where(
    and(
      eq(ideas.id, ideaId),
      eq(ideas.userId, userId),
      isNull(ideas.deletedAt)
    )
  ).limit(1);
  return rows[0] ?? null;
}
async function createIdea(idea) {
  const [created] = await getDb().insert(ideas).values(idea).returning();
  return created;
}
async function updateIdea(ideaId, userId, updates) {
  const [updated] = await getDb().update(ideas).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(ideas.id, ideaId), eq(ideas.userId, userId))).returning();
  return updated ?? null;
}
async function softDeleteIdea(ideaId, userId) {
  const [deleted] = await getDb().update(ideas).set({ deletedAt: /* @__PURE__ */ new Date() }).where(
    and(
      eq(ideas.id, ideaId),
      eq(ideas.userId, userId),
      isNull(ideas.deletedAt)
    )
  ).returning({ id: ideas.id });
  return deleted ?? null;
}
async function restoreIdea(ideaId, userId) {
  const [restored] = await getDb().update(ideas).set({ deletedAt: null }).where(and(eq(ideas.id, ideaId), eq(ideas.userId, userId))).returning();
  return restored ?? null;
}
async function listDeletedIdeas(userId) {
  return getDb().select().from(ideas).where(and(eq(ideas.userId, userId), isNotNull(ideas.deletedAt))).orderBy(desc(ideas.deletedAt));
}
async function deleteIdea(ideaId, userId) {
  const deleted = await getDb().delete(ideas).where(and(eq(ideas.id, ideaId), eq(ideas.userId, userId))).returning({ id: ideas.id });
  return deleted.length > 0;
}
async function listResearch(ideaId, userId) {
  return getDb().select().from(research).where(and(eq(research.ideaId, ideaId), eq(research.userId, userId))).orderBy(desc(research.createdAt));
}
async function addResearch(data) {
  const [created] = await getDb().insert(research).values(data).returning();
  return created;
}
async function deleteResearch(researchId, userId) {
  const deleted = await getDb().delete(research).where(and(eq(research.id, researchId), eq(research.userId, userId))).returning({ id: research.id });
  return deleted.length > 0;
}
async function listCategories(userId) {
  return getDb().select().from(userCategories).where(eq(userCategories.userId, userId)).orderBy(userCategories.sortOrder, userCategories.id);
}
async function createCategory(data) {
  const [created] = await getDb().insert(userCategories).values(data).onConflictDoNothing().returning();
  return created ?? null;
}
async function updateCategory(categoryId, userId, updates) {
  const [updated] = await getDb().update(userCategories).set(updates).where(
    and(eq(userCategories.id, categoryId), eq(userCategories.userId, userId))
  ).returning();
  return updated ?? null;
}
async function deleteCategory(categoryId, userId) {
  const deleted = await getDb().delete(userCategories).where(
    and(eq(userCategories.id, categoryId), eq(userCategories.userId, userId))
  ).returning({ id: userCategories.id });
  return deleted.length > 0;
}
async function getPreferences(userId) {
  const rows = await getDb().select().from(userPreferences).where(eq(userPreferences.userId, userId)).limit(1);
  if (rows[0]) return rows[0];
  const [created] = await getDb().insert(userPreferences).values({ userId }).returning();
  return created;
}
async function updatePreferences(userId, updates) {
  await getPreferences(userId);
  const [updated] = await getDb().update(userPreferences).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(userPreferences.userId, userId)).returning();
  return updated;
}
async function getDraftByIdeaId(ideaId, userId) {
  const rows = await getDb().select().from(drafts).where(and(eq(drafts.ideaId, ideaId), eq(drafts.userId, userId))).limit(1);
  return rows[0] ?? null;
}
async function listDrafts(userId) {
  return getDb().select().from(drafts).where(eq(drafts.userId, userId)).orderBy(desc(drafts.lastSavedAt));
}
async function saveDraft(data) {
  const now = /* @__PURE__ */ new Date();
  const [saved] = await getDb().insert(drafts).values({ ...data, lastSavedAt: now }).onConflictDoUpdate({
    target: drafts.ideaId,
    set: {
      content: data.content,
      wordCount: data.wordCount,
      characterCount: data.characterCount,
      ...data.platform ? { platform: data.platform } : {},
      lastSavedAt: now,
      updatedAt: now
    }
  }).returning();
  await getDb().update(ideas).set({ wordCount: data.wordCount, updatedAt: now }).where(and(eq(ideas.id, data.ideaId), eq(ideas.userId, data.userId)));
  return saved;
}
async function deleteDraft(draftId, userId) {
  const deleted = await getDb().delete(drafts).where(and(eq(drafts.id, draftId), eq(drafts.userId, userId))).returning({ id: drafts.id });
  return deleted.length > 0;
}
async function listThoughts(userId) {
  return getDb().select().from(rawThoughts).where(
    and(
      eq(rawThoughts.userId, userId),
      isNull(rawThoughts.deletedAt),
      isNull(rawThoughts.archivedAt)
    )
  ).orderBy(desc(rawThoughts.createdAt));
}
async function listArchivedThoughts(userId) {
  return getDb().select().from(rawThoughts).where(
    and(
      eq(rawThoughts.userId, userId),
      isNull(rawThoughts.deletedAt),
      isNotNull(rawThoughts.archivedAt)
    )
  ).orderBy(desc(rawThoughts.archivedAt));
}
async function setThoughtArchived(thoughtId, userId, archived) {
  const [row] = await getDb().update(rawThoughts).set({ archivedAt: archived ? /* @__PURE__ */ new Date() : null }).where(
    and(
      eq(rawThoughts.id, thoughtId),
      eq(rawThoughts.userId, userId),
      isNull(rawThoughts.deletedAt)
    )
  ).returning({ id: rawThoughts.id });
  return row ?? null;
}
async function listThoughtsForIdea(ideaId, userId) {
  return getDb().select().from(rawThoughts).where(
    and(
      eq(rawThoughts.userId, userId),
      eq(rawThoughts.linkedIdeaId, ideaId),
      isNull(rawThoughts.deletedAt)
    )
  ).orderBy(asc(rawThoughts.createdAt));
}
async function listUnlinkedThoughts(userId) {
  return getDb().select().from(rawThoughts).where(
    and(
      eq(rawThoughts.userId, userId),
      isNull(rawThoughts.linkedIdeaId),
      isNull(rawThoughts.deletedAt)
    )
  ).orderBy(desc(rawThoughts.createdAt));
}
async function linkThoughtsToIdea(thoughtIds2, ideaId, userId) {
  if (thoughtIds2.length === 0) return 0;
  const updated = await getDb().update(rawThoughts).set({ linkedIdeaId: ideaId, updatedAt: /* @__PURE__ */ new Date() }).where(
    and(
      eq(rawThoughts.userId, userId),
      inArray(rawThoughts.id, thoughtIds2),
      isNull(rawThoughts.deletedAt)
    )
  ).returning({ id: rawThoughts.id });
  return updated.length;
}
async function getThoughtsByIds(thoughtIds2, userId) {
  if (thoughtIds2.length === 0) return [];
  return getDb().select().from(rawThoughts).where(
    and(
      eq(rawThoughts.userId, userId),
      inArray(rawThoughts.id, thoughtIds2),
      isNull(rawThoughts.deletedAt)
    )
  ).orderBy(asc(rawThoughts.createdAt));
}
async function createThought(data) {
  const [created] = await getDb().insert(rawThoughts).values(data).returning();
  return created;
}
async function updateThought(thoughtId, userId, updates) {
  const [updated] = await getDb().update(rawThoughts).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(rawThoughts.id, thoughtId), eq(rawThoughts.userId, userId))).returning();
  return updated ?? null;
}
async function softDeleteThought(thoughtId, userId) {
  const [deleted] = await getDb().update(rawThoughts).set({ deletedAt: /* @__PURE__ */ new Date() }).where(
    and(
      eq(rawThoughts.id, thoughtId),
      eq(rawThoughts.userId, userId),
      isNull(rawThoughts.deletedAt)
    )
  ).returning({ id: rawThoughts.id });
  return deleted ?? null;
}
async function restoreThought(thoughtId, userId) {
  const [restored] = await getDb().update(rawThoughts).set({ deletedAt: null }).where(and(eq(rawThoughts.id, thoughtId), eq(rawThoughts.userId, userId))).returning();
  return restored ?? null;
}
async function listDeletedThoughts(userId) {
  return getDb().select().from(rawThoughts).where(
    and(eq(rawThoughts.userId, userId), isNotNull(rawThoughts.deletedAt))
  ).orderBy(desc(rawThoughts.deletedAt));
}
async function deleteThought(thoughtId, userId) {
  const deleted = await getDb().delete(rawThoughts).where(and(eq(rawThoughts.id, thoughtId), eq(rawThoughts.userId, userId))).returning({ id: rawThoughts.id });
  return deleted.length > 0;
}
async function purgeTrash(userId, olderThan) {
  const cutoff = olderThan ?? /* @__PURE__ */ new Date();
  const [purgedIdeas, purgedThoughts] = await Promise.all([
    getDb().delete(ideas).where(
      and(
        eq(ideas.userId, userId),
        isNotNull(ideas.deletedAt),
        lt(ideas.deletedAt, cutoff)
      )
    ).returning({ id: ideas.id }),
    getDb().delete(rawThoughts).where(
      and(
        eq(rawThoughts.userId, userId),
        isNotNull(rawThoughts.deletedAt),
        lt(rawThoughts.deletedAt, cutoff)
      )
    ).returning({ id: rawThoughts.id })
  ]);
  return purgedIdeas.length + purgedThoughts.length;
}
async function purgeExpiredTrash() {
  const cutoff = new Date(Date.now() - TRASH_RETENTION_MS);
  const [purgedIdeas, purgedThoughts] = await Promise.all([
    getDb().delete(ideas).where(and(isNotNull(ideas.deletedAt), lt(ideas.deletedAt, cutoff))).returning({ id: ideas.id }),
    getDb().delete(rawThoughts).where(
      and(isNotNull(rawThoughts.deletedAt), lt(rawThoughts.deletedAt, cutoff))
    ).returning({ id: rawThoughts.id })
  ]);
  return purgedIdeas.length + purgedThoughts.length;
}
async function recordWritingActivity(userId, ideaId, wordsAdded) {
  if (wordsAdded <= 0) return null;
  const [created] = await getDb().insert(writingSessions).values({ userId, ideaId, wordsWritten: wordsAdded, endedAt: /* @__PURE__ */ new Date() }).returning();
  return created;
}
async function listPrompts(userId) {
  return getDb().select().from(prompts).where(or(isNull(prompts.userId), eq(prompts.userId, userId))).orderBy(asc(prompts.id));
}
async function createPrompt(data) {
  const [created] = await getDb().insert(prompts).values({
    userId: data.userId,
    text: data.text,
    kind: data.kind ?? "general"
  }).returning();
  return created;
}
async function deletePrompt(promptId, userId) {
  const deleted = await getDb().delete(prompts).where(and(eq(prompts.id, promptId), eq(prompts.userId, userId))).returning({ id: prompts.id });
  return deleted.length > 0;
}
async function search(userId, term, filters = {}) {
  const trimmed = term.trim();
  if (trimmed.length === 0) return [];
  const pattern = `%${trimmed.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
  const matches = (column) => sql`${column} LIKE ${pattern} ESCAPE '\\'`;
  const wants = (kind) => !filters.kinds || filters.kinds.length === 0 || filters.kinds.includes(kind);
  const [ideaRows, thoughtRows, draftRows] = await Promise.all([
    wants("idea") ? getDb().select().from(ideas).where(
      and(
        eq(ideas.userId, userId),
        isNull(ideas.deletedAt),
        or(matches(ideas.title), matches(ideas.description))
      )
    ) : Promise.resolve([]),
    wants("thought") ? getDb().select().from(rawThoughts).where(
      and(
        eq(rawThoughts.userId, userId),
        isNull(rawThoughts.deletedAt),
        matches(rawThoughts.content)
      )
    ) : Promise.resolve([]),
    wants("draft") ? getDb().select({
      id: drafts.id,
      ideaId: drafts.ideaId,
      content: drafts.content,
      updatedAt: drafts.updatedAt,
      title: ideas.title,
      status: ideas.status,
      category: ideas.category
    }).from(drafts).innerJoin(ideas, eq(drafts.ideaId, ideas.id)).where(
      and(
        eq(drafts.userId, userId),
        isNull(ideas.deletedAt),
        matches(drafts.content)
      )
    ) : Promise.resolve([])
  ]);
  const now = /* @__PURE__ */ new Date();
  const hits = [
    ...ideaRows.map((idea) => ({
      kind: "idea",
      id: idea.id,
      ideaId: idea.id,
      title: idea.title,
      excerpt: idea.description ?? "",
      updatedAt: idea.updatedAt,
      status: idea.status,
      category: idea.category,
      score: scoreMatch(
        {
          kind: "idea",
          title: idea.title,
          body: idea.description ?? "",
          updatedAt: idea.updatedAt
        },
        trimmed,
        now
      )
    })),
    ...thoughtRows.map((thought) => ({
      kind: "thought",
      id: thought.id,
      ideaId: thought.linkedIdeaId,
      title: "Thought",
      excerpt: excerptAround(thought.content, trimmed),
      updatedAt: thought.updatedAt,
      status: null,
      category: null,
      score: scoreMatch(
        {
          kind: "thought",
          title: "",
          body: thought.content,
          updatedAt: thought.updatedAt
        },
        trimmed,
        now
      )
    })),
    ...draftRows.map((draft) => ({
      kind: "draft",
      id: draft.id,
      ideaId: draft.ideaId,
      title: draft.title,
      excerpt: excerptAround(draft.content, trimmed),
      updatedAt: draft.updatedAt,
      status: draft.status,
      category: draft.category,
      score: scoreMatch(
        {
          kind: "draft",
          title: draft.title,
          body: draft.content,
          updatedAt: draft.updatedAt
        },
        trimmed,
        now
      )
    }))
  ];
  return hits.filter((hit) => {
    if (filters.status && hit.status !== filters.status) return false;
    if (filters.category && hit.category !== filters.category) return false;
    if (filters.since && hit.updatedAt < filters.since) return false;
    return true;
  }).sort((a, b) => b.score - a.score).slice(0, 50);
}
function excerptAround(content, term, radius = 90) {
  const index2 = content.toLowerCase().indexOf(term.toLowerCase());
  if (index2 === -1) return content.slice(0, radius * 2);
  const start = Math.max(0, index2 - radius);
  const end = Math.min(content.length, index2 + term.length + radius);
  return `${start > 0 ? "\u2026" : ""}${content.slice(start, end)}${end < content.length ? "\u2026" : ""}`;
}
async function listWritingSessionTimes(userId) {
  return getDb().select({
    startedAt: writingSessions.startedAt,
    wordsWritten: writingSessions.wordsWritten
  }).from(writingSessions).where(eq(writingSessions.userId, userId));
}
var schema, cached, cachedClient;
var init_db = __esm({
  "server/db.ts"() {
    "use strict";
    init_schema();
    init_search();
    init_env();
    schema = {
      users,
      ideas,
      research,
      userCategories,
      userPreferences,
      drafts,
      rawThoughts,
      writingSessions,
      prompts,
      pushSubscriptions
    };
    cached = null;
    cachedClient = null;
  }
});

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure
  };
}
var init_cookies = __esm({
  "server/_core/cookies.ts"() {
    "use strict";
  }
});

// server/_core/auth.ts
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
async function createSessionToken(userId) {
  return new SignJWT({ sub: String(userId) }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setExpirationTime(Math.floor((Date.now() + SESSION_TTL_MS) / 1e3)).sign(secretKey);
}
async function readUserIdFromToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"]
    });
    const userId = Number.parseInt(String(payload.sub ?? ""), 10);
    return Number.isInteger(userId) ? userId : null;
  } catch {
    return null;
  }
}
async function authenticateRequest(req) {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const userId = await readUserIdFromToken(cookies[COOKIE_NAME]);
  if (userId === null) return null;
  const user = await findUserById(userId);
  return user ? toPublicUser(user) : null;
}
function setSessionCookie(req, res, token) {
  res.cookie(COOKIE_NAME, token, {
    ...getSessionCookieOptions(req),
    maxAge: SESSION_TTL_MS
  });
}
function clearSessionCookie(req, res) {
  res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
}
var secretKey;
var init_auth = __esm({
  "server/_core/auth.ts"() {
    "use strict";
    init_const();
    init_db();
    init_env();
    init_cookies();
    secretKey = new TextEncoder().encode(ENV.sessionSecret);
  }
});

// server/_core/context.ts
async function createContext(opts) {
  return {
    req: opts.req,
    res: opts.res,
    user: await authenticateRequest(opts.req)
  };
}
var init_context = __esm({
  "server/_core/context.ts"() {
    "use strict";
    init_auth();
  }
});

// server/_core/oauth.ts
import crypto2 from "node:crypto";
import { createRemoteJWKSet, jwtVerify as jwtVerify2 } from "jose";
function googleRedirectUri() {
  return `${ENV.appUrl}/api/auth/google/callback`;
}
function randomToken(bytes = 32) {
  return crypto2.randomBytes(bytes).toString("base64url");
}
function s256(verifier) {
  return crypto2.createHash("sha256").update(verifier).digest("base64url");
}
function buildGoogleAuthUrl() {
  const state = randomToken(16);
  const verifier = randomToken(32);
  const params = new URLSearchParams({
    client_id: ENV.googleClientId ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: s256(verifier),
    code_challenge_method: "S256",
    // Always show the picker rather than silently reusing one Google session,
    // because shared machines are common and surprise-signing-in is hostile.
    prompt: "select_account"
  });
  return { url: `${AUTH_ENDPOINT}?${params}`, state, verifier };
}
async function exchangeGoogleCode(code, verifier) {
  if (!ENV.googleClientId || !ENV.googleClientSecret) {
    throw new Error("Google sign-in is not configured.");
  }
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: ENV.googleClientId,
      client_secret: ENV.googleClientSecret,
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier
    })
  });
  if (!response.ok) {
    throw new Error(`Google rejected the code exchange (${response.status}).`);
  }
  const tokens = await response.json();
  if (!tokens.id_token) {
    throw new Error("Google's response contained no id_token.");
  }
  const { payload } = await jwtVerify2(tokens.id_token, googleKeys, {
    issuer: ISSUERS,
    audience: ENV.googleClientId
  });
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  if (!payload.sub || !email) {
    throw new Error("Google's token was missing a subject or email.");
  }
  return {
    googleId: String(payload.sub),
    email,
    // Google sends this as a boolean or the string "true" depending on flow.
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
    name: typeof payload.name === "string" ? payload.name : null,
    avatarUrl: typeof payload.picture === "string" ? payload.picture : null
  };
}
var AUTH_ENDPOINT, TOKEN_ENDPOINT, ISSUERS, googleKeys;
var init_oauth = __esm({
  "server/_core/oauth.ts"() {
    "use strict";
    init_env();
    AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
    TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
    ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
    googleKeys = createRemoteJWKSet(
      new URL("https://www.googleapis.com/oauth2/v3/certs")
    );
  }
});

// server/_core/rateLimit.ts
import { TRPCError } from "@trpc/server";
function sweep(now) {
  if (windows.size < 5e3) return;
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}
function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const first = raw.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}
function consume(key, rule) {
  const now = Date.now();
  sweep(now);
  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + rule.windowMs });
    return;
  }
  existing.count += 1;
  if (existing.count > rule.limit) {
    const minutes = Math.max(1, Math.ceil((existing.resetAt - now) / 6e4));
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`
    });
  }
}
var windows, AUTH_LIMITS, WRITE_LIMIT;
var init_rateLimit = __esm({
  "server/_core/rateLimit.ts"() {
    "use strict";
    windows = /* @__PURE__ */ new Map();
    AUTH_LIMITS = {
      /**
       * Starting the Google handshake. There is no password to guess, so this is
       * about stopping someone hammering the redirect endpoint rather than
       * protecting a credential.
       */
      login: { limit: 20, windowMs: 15 * 60 * 1e3 },
      /** Demo sandboxes, which cost a database write and a seed each. */
      demo: { limit: 6, windowMs: 60 * 60 * 1e3 }
    };
    WRITE_LIMIT = { limit: 600, windowMs: 6e4 };
  }
});

// server/googleAuth.ts
import { parse as parseCookieHeader2 } from "cookie";
function fail(res, reason) {
  res.redirect(`/signin?error=${encodeURIComponent(reason)}`);
}
function mountGoogleAuth(app2) {
  app2.get("/api/auth/google", (req, res) => {
    if (!googleEnabled()) return fail(res, "google_unavailable");
    try {
      consume(`google:${clientIp(req)}`, AUTH_LIMITS.login);
    } catch {
      return fail(res, "rate_limited");
    }
    const { url, state, verifier } = buildGoogleAuthUrl();
    const options = {
      ...getSessionCookieOptions(req),
      maxAge: HANDSHAKE_TTL_MS
    };
    res.cookie(STATE_COOKIE, state, options);
    res.cookie(VERIFIER_COOKIE, verifier, options);
    res.redirect(url);
  });
  app2.get("/api/auth/google/callback", async (req, res) => {
    if (!googleEnabled()) return fail(res, "google_unavailable");
    const cookies = parseCookieHeader2(req.headers.cookie ?? "");
    const expectedState = cookies[STATE_COOKIE];
    const verifier = cookies[VERIFIER_COOKIE];
    const clearOptions = getSessionCookieOptions(req);
    res.clearCookie(STATE_COOKIE, clearOptions);
    res.clearCookie(VERIFIER_COOKIE, clearOptions);
    const { code, state, error } = req.query;
    if (typeof error === "string") return fail(res, "cancelled");
    if (typeof code !== "string" || typeof state !== "string") {
      return fail(res, "bad_response");
    }
    if (!expectedState || !verifier || state !== expectedState) {
      return fail(res, "bad_state");
    }
    try {
      const identity = await exchangeGoogleCode(code, verifier);
      if (!identity.emailVerified) return fail(res, "email_unverified");
      let user = await findUserByGoogleId(identity.googleId);
      if (!user) {
        const existing = await findUserByEmail(identity.email);
        if (existing) {
          if (existing.demoExpiresAt) return fail(res, "sandbox_conflict");
          user = await linkGoogleId(
            existing.id,
            identity.googleId,
            identity.avatarUrl
          );
        } else {
          user = await createGoogleUser({
            email: identity.email,
            googleId: identity.googleId,
            name: identity.name,
            avatarUrl: identity.avatarUrl
          });
          await getPreferences(user.id);
          await Promise.all(
            STARTER_CATEGORIES.map(
              (category, index2) => createCategory({
                userId: user.id,
                ...category,
                sortOrder: index2
              })
            )
          );
        }
      } else {
        await touchLastSignedIn(user.id);
      }
      setSessionCookie(req, res, await createSessionToken(user.id));
      res.redirect("/");
    } catch (caught) {
      console.error("[google] sign-in failed:", caught);
      fail(res, "signin_failed");
    }
  });
  if (googleEnabled()) {
    console.log(
      `  Google sign-in enabled \u2192 ${ENV.appUrl}/api/auth/google/callback`
    );
  }
}
var STATE_COOKIE, VERIFIER_COOKIE, HANDSHAKE_TTL_MS, STARTER_CATEGORIES;
var init_googleAuth = __esm({
  "server/googleAuth.ts"() {
    "use strict";
    init_auth();
    init_cookies();
    init_env();
    init_oauth();
    init_rateLimit();
    init_db();
    STATE_COOKIE = "g_state";
    VERIFIER_COOKIE = "g_verify";
    HANDSHAKE_TTL_MS = 10 * 60 * 1e3;
    STARTER_CATEGORIES = [
      { name: "Technical Deep Dive", color: "#0d5f5f" },
      { name: "Personal Reflection", color: "#d4a574" },
      { name: "Creative Exploration", color: "#7a9b8e" },
      { name: "Quick Observations", color: "#2a2a2a" }
    ];
  }
});

// shared/reminders.ts
function zonedParts(at, timeZone) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short"
    }).formatToParts(at);
  } catch {
    return zonedParts(at, "UTC");
  }
  const find = (type) => parts.find((part) => part.type === type)?.value ?? "";
  const weekdays = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  const hour = Number(find("hour")) % 24;
  return {
    year: Number(find("year")),
    month: Number(find("month")),
    day: Number(find("day")),
    hour,
    minute: Number(find("minute")),
    weekday: weekdays[find("weekday")] ?? 0,
    dayKey: `${find("year")}-${find("month")}-${find("day")}`
  };
}
function matchesSchedule(frequency, days, parts) {
  switch (frequency) {
    case "daily":
      return true;
    case "weekly":
      return parts.weekday === (days[0] ?? 1);
    case "monthly":
      return parts.day === (days[0] ?? 1);
    case "custom":
      return days.includes(parts.weekday);
    case "off":
      return false;
  }
}
function isReminderDue(settings, now, graceMinutes = 120) {
  if (settings.frequency === "off") return false;
  const parts = zonedParts(now, settings.timeZone);
  if (!matchesSchedule(settings.frequency, settings.days, parts)) return false;
  const [hourText, minuteText] = settings.time.split(":");
  const targetMinutes = Number(hourText) * 60 + Number(minuteText);
  const nowMinutes = parts.hour * 60 + parts.minute;
  const elapsed = nowMinutes - targetMinutes;
  if (elapsed < 0 || elapsed > graceMinutes) return false;
  if (settings.lastRemindedAt) {
    const last = zonedParts(settings.lastRemindedAt, settings.timeZone);
    if (last.dayKey === parts.dayKey) return false;
  }
  return true;
}
function reminderMessage(unsortedThoughts) {
  if (unsortedThoughts >= 3) {
    return {
      title: "There's a pile waiting",
      body: `${unsortedThoughts} loose thoughts. Some of them probably belong together.`
    };
  }
  return {
    title: "Time to write, if you'd like",
    body: "A few minutes is enough. It doesn't have to be good."
  };
}
var init_reminders = __esm({
  "shared/reminders.ts"() {
    "use strict";
  }
});

// server/_core/push.ts
import webpush from "web-push";
function pushEnabled() {
  return Boolean(ENV.vapidPublicKey && ENV.vapidPrivateKey);
}
function configure() {
  if (configured || !pushEnabled()) return;
  webpush.setVapidDetails(
    // The contact is required by the spec so a push service can reach the
    // operator about a misbehaving sender.
    ENV.vapidSubject,
    ENV.vapidPublicKey,
    ENV.vapidPrivateKey
  );
  configured = true;
}
async function sendPush(target, message) {
  if (!pushEnabled()) return "failed";
  configure();
  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth }
      },
      JSON.stringify(message),
      { TTL: 12 * 60 * 60 }
    );
    return "sent";
  } catch (error) {
    const status2 = error.statusCode;
    if (status2 === 404 || status2 === 410) return "gone";
    report({
      source: "server",
      message: `Push failed (${status2 ?? "no status"}): ${error instanceof Error ? error.message : String(error)}`
    });
    return "failed";
  }
}
var configured;
var init_push = __esm({
  "server/_core/push.ts"() {
    "use strict";
    init_env();
    init_observability();
    configured = false;
  }
});

// server/reminders.ts
function parseDays(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((day) => typeof day === "number") : [];
  } catch {
    return [];
  }
}
async function sendDueReminders(now = /* @__PURE__ */ new Date()) {
  if (!pushEnabled()) return 0;
  const candidates = await listReminderCandidates();
  let sent = 0;
  for (const candidate of candidates) {
    const due = isReminderDue(
      {
        frequency: candidate.frequency,
        time: candidate.time,
        days: parseDays(candidate.days),
        timeZone: candidate.timeZone,
        lastRemindedAt: candidate.lastRemindedAt
      },
      now
    );
    if (!due) continue;
    const subscriptions = await listPushSubscriptions(candidate.userId);
    if (subscriptions.length === 0) continue;
    const pile = await listUnlinkedThoughts(candidate.userId);
    const message = reminderMessage(pile.length);
    let anyDelivered = false;
    for (const subscription of subscriptions) {
      const result = await sendPush(subscription, {
        ...message,
        url: `${ENV.appUrl}/`
      });
      if (result === "gone") {
        await deletePushSubscription(subscription.endpoint);
      } else if (result === "sent") {
        anyDelivered = true;
      }
    }
    if (anyDelivered) {
      await markReminded(candidate.userId);
      sent += 1;
    }
  }
  return sent;
}
var TICK_MS;
var init_reminders2 = __esm({
  "server/reminders.ts"() {
    "use strict";
    init_reminders();
    init_env();
    init_observability();
    init_push();
    init_db();
    TICK_MS = 5 * 60 * 1e3;
  }
});

// server/cron.ts
function authorised(req) {
  const secret = ENV.cronSecret;
  if (!secret) return false;
  const header = req.headers.authorization;
  return header === `Bearer ${secret}`;
}
function mountCron(app2) {
  app2.get("/api/cron/reminders", async (req, res) => {
    if (!authorised(req)) {
      res.status(401).json({ error: "Unauthorised" });
      return;
    }
    try {
      const sent = await sendDueReminders();
      res.json({ ok: true, sent });
    } catch (error) {
      report({
        source: "server",
        message: `Reminder cron failed: ${error instanceof Error ? error.message : String(error)}`,
        stack: error instanceof Error ? error.stack : void 0
      });
      res.status(500).json({ ok: false });
    }
  });
  app2.get("/api/cron/sweep", async (req, res) => {
    if (!authorised(req)) {
      res.status(401).json({ error: "Unauthorised" });
      return;
    }
    try {
      const [sandboxes, trashed] = await Promise.all([
        purgeExpiredDemoUsers(),
        purgeExpiredTrash()
      ]);
      res.json({ ok: true, sandboxes, trashed });
    } catch (error) {
      report({
        source: "server",
        message: `Sweep cron failed: ${error instanceof Error ? error.message : String(error)}`
      });
      res.status(500).json({ ok: false });
    }
  });
}
var init_cron = __esm({
  "server/cron.ts"() {
    "use strict";
    init_env();
    init_observability();
    init_db();
    init_reminders2();
  }
});

// server/publicShelf.ts
var publicShelf_exports = {};
__export(publicShelf_exports, {
  injectShelfMeta: () => injectShelfMeta,
  mountPublicShelf: () => mountPublicShelf
});
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function escapeXml(value) {
  return escapeHtml(value);
}
function mountPublicShelf(app2) {
  app2.get("/@:username/feed.xml", async (req, res) => {
    const user = await findUserByUsername(req.params.username);
    if (!user || !user.publicProfile || !user.username) {
      res.status(404).type("text/plain").send("No shelf here.");
      return;
    }
    const pieces = await listPublishedIdeas(user.id);
    const name = user.name ?? user.username;
    const shelfUrl = `${ENV.appUrl}/@${user.username}`;
    const items = pieces.map((piece) => {
      const link = piece.publishedUrl ?? shelfUrl;
      return `    <item>
      <title>${escapeXml(piece.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="false">writing-assistant-${piece.id}</guid>
      <pubDate>${(piece.publishedAt ?? piece.createdAt).toUTCString()}</pubDate>
      ${piece.description ? `<description>${escapeXml(piece.description)}</description>` : ""}
    </item>`;
    }).join("\n");
    res.type("application/rss+xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(name)}</title>
    <link>${escapeXml(shelfUrl)}</link>
    <description>${escapeXml(user.bio ?? `Writing published by ${name}.`)}</description>
    <atom:link href="${escapeXml(`${shelfUrl}/feed.xml`)}" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`);
  });
  app2.use(async (req, res, next) => {
    const match = /^\/@([A-Za-z0-9_-]+)\/?$/.exec(req.path);
    if (!match || req.method !== "GET") return next();
    const user = await findUserByUsername(match[1]);
    if (!user || !user.publicProfile || !user.username) return next();
    const pieces = await listPublishedIdeas(user.id);
    const name = user.name ?? user.username;
    const words = pieces.reduce((sum, piece) => sum + piece.wordCount, 0);
    const description = user.bio ?? `${pieces.length} piece${pieces.length === 1 ? "" : "s"} published` + (words > 0 ? `, ${words.toLocaleString()} words.` : ".");
    res.locals.shelfMeta = {
      title: `${name} \u2014 published writing`,
      description,
      url: `${ENV.appUrl}/@${user.username}`,
      feed: `${ENV.appUrl}/@${user.username}/feed.xml`
    };
    next();
  });
}
function injectShelfMeta(html, meta) {
  const tags = `
    <title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <link rel="alternate" type="application/rss+xml" title="${escapeHtml(meta.title)}" href="${escapeHtml(meta.feed)}" />
    <meta property="og:type" content="profile" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:url" content="${escapeHtml(meta.url)}" />
    <meta property="og:image" content="${escapeHtml(`${ENV.appUrl}/icon-512.png`)}" />
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
    <meta name="twitter:image" content="${escapeHtml(`${ENV.appUrl}/icon-512.png`)}" />`;
  return html.replace(/<title>[\s\S]*?<\/title>/, "").replace(/<meta\s+name="description"[^>]*\/?>/, "").replace("</head>", `${tags}
  </head>`);
}
var init_publicShelf = __esm({
  "server/publicShelf.ts"() {
    "use strict";
    init_env();
    init_db();
  }
});

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t, router, publicProcedure, requireUser, limitWrites, protectedProcedure, adminProcedure;
var init_trpc = __esm({
  "server/_core/trpc.ts"() {
    "use strict";
    init_const();
    init_rateLimit();
    t = initTRPC.context().create({
      transformer: superjson
    });
    router = t.router;
    publicProcedure = t.procedure;
    requireUser = t.middleware(async (opts) => {
      const { ctx, next } = opts;
      if (!ctx.user) {
        throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      }
      return next({
        ctx: {
          ...ctx,
          user: ctx.user
        }
      });
    });
    limitWrites = t.middleware(async (opts) => {
      if (opts.type === "mutation" && opts.ctx.user) {
        consume(`write:${opts.ctx.user.id}`, WRITE_LIMIT);
      }
      return opts.next();
    });
    protectedProcedure = t.procedure.use(requireUser).use(limitWrites);
    adminProcedure = t.procedure.use(
      t.middleware(async (opts) => {
        const { ctx, next } = opts;
        if (!ctx.user || ctx.user.role !== "admin") {
          throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
        }
        return next({
          ctx: {
            ...ctx,
            user: ctx.user
          }
        });
      })
    );
  }
});

// server/routers/account.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z } from "zod";
var accountRouter;
var init_account = __esm({
  "server/routers/account.ts"() {
    "use strict";
    init_auth();
    init_trpc();
    init_db();
    accountRouter = router({
      /** Everything the account owns, as one JSON document the client saves. */
      exportData: protectedProcedure.query(({ ctx }) => exportAccount(ctx.user.id)),
      /**
       * Deletes the account and all of its writing.
       *
       * The typed confirmation is checked on the server as well as in the dialog:
       * a client-side-only guard is a suggestion, and this is the one call in the
       * app that nothing can undo.
       */
      delete: protectedProcedure.input(z.object({ confirmation: z.string() })).mutation(async ({ ctx, input }) => {
        const user = await findUserById(ctx.user.id);
        if (!user) {
          throw new TRPCError3({
            code: "NOT_FOUND",
            message: "Account not found."
          });
        }
        if (input.confirmation.trim().toLowerCase() !== user.email.toLowerCase()) {
          throw new TRPCError3({
            code: "BAD_REQUEST",
            message: "That didn't match your email address, so nothing was deleted."
          });
        }
        const deleted = await deleteAccount(user.id);
        if (!deleted) {
          throw new TRPCError3({
            code: "INTERNAL_SERVER_ERROR",
            message: "Could not delete the account. Nothing was changed."
          });
        }
        clearSessionCookie(ctx.req, ctx.res);
        return { success: true };
      })
    });
  }
});

// server/sandbox.ts
import { eq as eq2 } from "drizzle-orm";
function countWords(content) {
  const trimmed = content.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}
function daysAgo(days, hour = 9) {
  const date = /* @__PURE__ */ new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 30, 0, 0);
  return date;
}
async function seedSandbox(userId) {
  await getPreferences(userId);
  await updatePreferences(userId, {
    onboardingCompleted: true,
    defaultPlatform: "both"
  });
  for (const [index2, category] of CATEGORIES.entries()) {
    await createCategory({ userId, ...category, sortOrder: index2 });
  }
  for (const seedIdea of IDEAS) {
    const { draft, publishedDaysAgo, ...fields } = seedIdea;
    const idea = await createIdea({
      userId,
      ...fields,
      ...publishedDaysAgo === void 0 ? {} : { publishedAt: daysAgo(publishedDaysAgo) }
    });
    if (draft) {
      await saveDraft({
        userId,
        ideaId: idea.id,
        content: draft,
        wordCount: countWords(draft),
        characterCount: draft.length,
        platform: fields.platform
      });
    }
  }
  const mergeTarget = await createIdea({
    userId,
    title: "Why postmortems are the best writing in tech",
    description: "Built from three thoughts caught over a fortnight.",
    category: "Creative Exploration",
    status: "draft",
    platform: "both"
  });
  const mergedIds = [];
  for (const thought of THOUGHTS) {
    const created = await createThought({
      userId,
      content: thought.content,
      tags: thought.tags.length ? JSON.stringify(thought.tags) : null
    });
    if (thought.mergeInto) mergedIds.push(created.id);
  }
  await linkThoughtsToIdea(mergedIds, mergeTarget.id, userId);
  await backdateWritingHistory(userId);
}
async function backdateWritingHistory(userId) {
  const db = getDb();
  await db.delete(writingSessions).where(eq2(writingSessions.userId, userId));
  for (const offset of [0, 1, 2, 3, 6, 7, 8, 12, 13, 20]) {
    const day = daysAgo(offset, 7);
    await db.insert(writingSessions).values({
      userId,
      startedAt: day,
      endedAt: day,
      wordsWritten: 180 + offset * 37 % 250,
      createdAt: day
    });
  }
}
var CATEGORIES, IDEAS, THOUGHTS;
var init_sandbox = __esm({
  "server/sandbox.ts"() {
    "use strict";
    init_schema();
    init_db();
    CATEGORIES = [
      {
        name: "Technical Deep Dive",
        description: "Systems, architecture, and the things that break in production.",
        color: "#0d5f5f"
      },
      {
        name: "Personal Reflection",
        description: "Career turns, lessons learned the hard way, honest retrospectives.",
        color: "#d4a574"
      },
      {
        name: "Creative Exploration",
        description: "Where design, art, and engineering overlap.",
        color: "#7a9b8e"
      },
      {
        name: "Quick Observations",
        description: "Short takes that don't need a thousand words.",
        color: "#8a6f5c"
      }
    ];
    IDEAS = [
      {
        title: "What I got wrong about database indexes",
        description: "Three years of adding indexes to fix slow queries, and a benchmark that showed half of them were never used.",
        category: "Technical Deep Dive",
        status: "published",
        platform: "medium",
        publishedUrl: "https://example.com/database-indexes",
        publishedIn: "Medium",
        /** Days ago, so the shipped shelf has a plausible history. */
        publishedDaysAgo: 24,
        draft: `# What I got wrong about database indexes

For a long time my answer to a slow query was the same: add an index. It worked often enough that I stopped questioning it.

Then I ran \`pg_stat_user_indexes\` against a production database I'd been tending for three years. Of the forty-one indexes I had added, nineteen had never been scanned. Not once.

## The cost nobody mentions

An unused index isn't free. Every write pays for it.`
      },
      {
        title: "Error messages are documentation",
        description: "The one piece of writing every engineer does, and mostly does badly.",
        category: "Quick Observations",
        status: "published",
        platform: "substack",
        publishedUrl: "https://example.com/error-messages",
        publishedIn: "Substack",
        publishedDaysAgo: 9,
        draft: `# Error messages are documentation

Nobody reads the docs. Everybody reads the error.

That asymmetry should change how much care an error message gets, and mostly it doesn't. We write \`Invalid input\` and move on, and then answer the same support question eleven times.

A good error message answers three questions: what happened, why, and what to do next.`
      },
      {
        title: "The case for boring technology",
        description: "Why the most interesting thing about a stack is often how little of it is interesting.",
        category: "Personal Reflection",
        status: "in-progress",
        platform: "substack",
        draft: `# The case for boring technology

I have a rule now: every genuinely novel piece of technology in a system costs the team something. Not in licence fees \u2014 in the hours nobody budgets for.

The question isn't whether the new thing is better. It usually is, on the dimension its authors care about. The question is whether it is better by enough to pay for the debugging you'll do at 2am.`
      },
      {
        title: "Reading code like a stranger",
        description: "A technique for reviewing your own work: come back after a week and pretend you've never seen it.",
        category: "Technical Deep Dive",
        status: "outline",
        platform: "both",
        draft: `# Reading code like a stranger

Outline:

- The problem: you can't see your own assumptions
- The week-long gap, and why shorter doesn't work
- Reading top-down instead of in the order you wrote it
- What to write down as you go`
      },
      {
        title: "Notes on writing while employed full-time",
        description: "Forty-five minutes, four mornings a week, and what actually fits in that.",
        category: "Personal Reflection",
        status: "draft",
        platform: "substack"
      }
    ];
    THOUGHTS = [
      {
        content: "The best technical writing I've read all year was a postmortem. Nobody sets out to write a postmortem well and yet.",
        tags: ["writing", "craft"],
        mergeInto: "Why postmortems are the best writing in tech"
      },
      {
        content: "Half-thought \u2014 the reason code review feels bad is that it's the only time most engineers get feedback on writing.",
        tags: ["review", "half-baked"],
        mergeInto: "Why postmortems are the best writing in tech"
      },
      {
        content: "A postmortem has a built-in structure: what happened, why, what changed. Most essays would be better with that skeleton.",
        tags: ["craft"],
        mergeInto: "Why postmortems are the best writing in tech"
      },
      {
        content: "Idea: a piece about the moment a codebase stops fitting in your head, and what you do differently after.",
        tags: ["ideas"]
      },
      {
        content: "Everyone says 'write what you know'. Nobody mentions you learn what you know by writing.",
        tags: []
      },
      {
        content: "Three unrelated outages this month all traced back to a retry with no jitter.",
        tags: ["incidents"]
      }
    ];
  }
});

// server/routers/auth.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
import crypto3 from "node:crypto";
var MAX_LIVE_SANDBOXES, authRouter;
var init_auth2 = __esm({
  "server/routers/auth.ts"() {
    "use strict";
    init_auth();
    init_env();
    init_rateLimit();
    init_trpc();
    init_db();
    init_sandbox();
    MAX_LIVE_SANDBOXES = 200;
    authRouter = router({
      /** The signed-in user, or null. Drives every auth check on the client. */
      me: publicProcedure.query(({ ctx }) => ctx.user),
      /** Whether to show "Continue with Google" — off unless credentials exist. */
      googleAvailable: publicProcedure.query(() => googleEnabled()),
      /** Whether the "Try it without an account" button should be offered. */
      demoAvailable: publicProcedure.query(() => ENV.demoMode),
      /**
       * Hands out a private sandbox: a throwaway account, seeded with sample
       * writing, that deletes itself after a day. No credentials are involved, so
       * it doubles as the way to run the app locally without Google configured.
       */
      startSandbox: publicProcedure.mutation(async ({ ctx }) => {
        if (!ENV.demoMode) {
          throw new TRPCError4({
            code: "FORBIDDEN",
            message: "Demo mode is disabled."
          });
        }
        consume(`demo:${clientIp(ctx.req)}`, AUTH_LIMITS.demo);
        await purgeExpiredDemoUsers();
        if (await countLiveSandboxes() >= MAX_LIVE_SANDBOXES) {
          throw new TRPCError4({
            code: "TOO_MANY_REQUESTS",
            message: "Too many people are trying the demo right now. Sign in with Google, or try again a bit later."
          });
        }
        const handle = crypto3.randomBytes(8).toString("hex");
        const user = await createDemoUser({
          // Reachable only by its cookie, and never a real address, so it cannot
          // collide with a Google account someone signs in with later.
          email: `sandbox-${handle}@demo.invalid`,
          name: "Guest writer",
          expiresAt: new Date(Date.now() + DEMO_TTL_MS)
        });
        await seedSandbox(user.id);
        setSessionCookie(ctx.req, ctx.res, await createSessionToken(user.id));
        return toPublicUser(user);
      }),
      logout: publicProcedure.mutation(({ ctx }) => {
        clearSessionCookie(ctx.req, ctx.res);
        return { success: true };
      })
    });
  }
});

// server/routers/categories.ts
import { TRPCError as TRPCError5 } from "@trpc/server";
import { z as z2 } from "zod";
var hexColor, categoriesRouter;
var init_categories = __esm({
  "server/routers/categories.ts"() {
    "use strict";
    init_schema();
    init_trpc();
    init_db();
    hexColor = z2.string().regex(/^#[0-9a-f]{6}$/i, "Use a hex colour like #0d5f5f.");
    categoriesRouter = router({
      list: protectedProcedure.query(({ ctx }) => listCategories(ctx.user.id)),
      create: protectedProcedure.input(
        z2.object({
          name: z2.string().trim().min(1, "Name the category.").max(100),
          description: z2.string().trim().max(500).optional(),
          color: hexColor.optional()
        })
      ).mutation(async ({ ctx, input }) => {
        const existing = await listCategories(ctx.user.id);
        const created = await createCategory({
          userId: ctx.user.id,
          name: input.name,
          description: input.description,
          color: input.color ?? "#0d5f5f",
          sortOrder: existing.length
        });
        if (!created) {
          throw new TRPCError5({
            code: "CONFLICT",
            message: `You already have a category called "${input.name}".`
          });
        }
        return created;
      }),
      update: protectedProcedure.input(
        z2.object({
          id: z2.number().int().positive(),
          name: z2.string().trim().min(1).max(100).optional(),
          description: z2.string().trim().max(500).optional(),
          color: hexColor.optional()
        })
      ).mutation(async ({ ctx, input }) => {
        const { id, ...updates } = input;
        const updated = await updateCategory(id, ctx.user.id, updates);
        if (!updated) {
          throw new TRPCError5({
            code: "NOT_FOUND",
            message: "That category no longer exists."
          });
        }
        return updated;
      }),
      delete: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const deleted = await deleteCategory(input.id, ctx.user.id);
        if (!deleted) {
          throw new TRPCError5({
            code: "NOT_FOUND",
            message: "That category no longer exists."
          });
        }
        return { success: true };
      }),
      getPreferences: protectedProcedure.query(
        ({ ctx }) => getPreferences(ctx.user.id)
      ),
      updatePreferences: protectedProcedure.input(
        z2.object({
          defaultPlatform: z2.enum(PLATFORMS).optional(),
          onboardingCompleted: z2.boolean().optional(),
          /** 0 turns the goal off. Capped so a typo can't set an absurd target. */
          dailyWordGoal: z2.number().int().min(0).max(2e4).optional()
        })
      ).mutation(({ ctx, input }) => updatePreferences(ctx.user.id, input)),
      completeOnboarding: protectedProcedure.input(
        z2.object({
          categories: z2.array(z2.string().trim().min(1).max(100)).max(20).optional()
        })
      ).mutation(async ({ ctx, input }) => {
        const existing = await listCategories(ctx.user.id);
        const known = new Set(
          existing.map((category) => category.name.toLowerCase())
        );
        let sortOrder = existing.length;
        for (const name of input.categories ?? []) {
          if (known.has(name.toLowerCase())) continue;
          known.add(name.toLowerCase());
          await createCategory({
            userId: ctx.user.id,
            name,
            color: "#0d5f5f",
            sortOrder: sortOrder++
          });
        }
        await updatePreferences(ctx.user.id, { onboardingCompleted: true });
        return { success: true };
      })
    });
  }
});

// server/routers/drafts.ts
import { TRPCError as TRPCError6 } from "@trpc/server";
import { z as z3 } from "zod";
function countWords2(content) {
  const trimmed = content.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}
var draftsRouter;
var init_drafts = __esm({
  "server/routers/drafts.ts"() {
    "use strict";
    init_schema();
    init_trpc();
    init_db();
    draftsRouter = router({
      getByIdeaId: protectedProcedure.input(z3.object({ ideaId: z3.number().int().positive() })).query(({ ctx, input }) => getDraftByIdeaId(input.ideaId, ctx.user.id)),
      list: protectedProcedure.query(({ ctx }) => listDrafts(ctx.user.id)),
      /**
       * Autosave target. Counts are derived server-side so the numbers on the
       * dashboard can't drift from the stored prose.
       */
      save: protectedProcedure.input(
        z3.object({
          ideaId: z3.number().int().positive(),
          content: z3.string().max(5e5),
          platform: z3.enum(PLATFORMS).optional()
        })
      ).mutation(async ({ ctx, input }) => {
        const idea = await getIdea(input.ideaId, ctx.user.id);
        if (!idea) {
          throw new TRPCError6({
            code: "NOT_FOUND",
            message: "That idea no longer exists."
          });
        }
        const previous = await getDraftByIdeaId(input.ideaId, ctx.user.id);
        const wordCount = countWords2(input.content);
        const saved = await saveDraft({
          userId: ctx.user.id,
          ideaId: input.ideaId,
          content: input.content,
          wordCount,
          characterCount: input.content.length,
          platform: input.platform
        });
        await recordWritingActivity(
          ctx.user.id,
          input.ideaId,
          wordCount - (previous?.wordCount ?? 0)
        );
        return saved;
      }),
      delete: protectedProcedure.input(z3.object({ draftId: z3.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const deleted = await deleteDraft(input.draftId, ctx.user.id);
        if (!deleted) {
          throw new TRPCError6({
            code: "NOT_FOUND",
            message: "That draft no longer exists."
          });
        }
        return { success: true };
      })
    });
  }
});

// server/routers/ideas.ts
import { TRPCError as TRPCError7 } from "@trpc/server";
import { z as z4 } from "zod";
var platform, status, ideasRouter;
var init_ideas = __esm({
  "server/routers/ideas.ts"() {
    "use strict";
    init_schema();
    init_trpc();
    init_db();
    platform = z4.enum(PLATFORMS);
    status = z4.enum(IDEA_STATUSES);
    ideasRouter = router({
      list: protectedProcedure.query(({ ctx }) => listIdeas(ctx.user.id)),
      /** The shipped shelf — everything that actually went out. */
      listPublished: protectedProcedure.query(
        ({ ctx }) => listPublishedIdeas(ctx.user.id)
      ),
      listDeleted: protectedProcedure.query(
        ({ ctx }) => listDeletedIdeas(ctx.user.id)
      ),
      get: protectedProcedure.input(z4.object({ id: z4.number().int().positive() })).query(async ({ ctx, input }) => {
        const idea = await getIdea(input.id, ctx.user.id);
        if (!idea) {
          throw new TRPCError7({
            code: "NOT_FOUND",
            message: "That idea no longer exists."
          });
        }
        return idea;
      }),
      create: protectedProcedure.input(
        z4.object({
          title: z4.string().trim().min(1, "Give the idea a title.").max(200),
          description: z4.string().trim().max(2e3).optional(),
          /** Free text: categories are user-defined, not a fixed enum. */
          category: z4.string().trim().min(1, "Pick a category.").max(100),
          platform: platform.optional()
        })
      ).mutation(
        ({ ctx, input }) => createIdea({
          userId: ctx.user.id,
          title: input.title,
          description: input.description,
          category: input.category,
          platform: input.platform ?? "both",
          status: "draft"
        })
      ),
      update: protectedProcedure.input(
        z4.object({
          id: z4.number().int().positive(),
          title: z4.string().trim().min(1).max(200).optional(),
          description: z4.string().trim().max(2e3).optional(),
          category: z4.string().trim().min(1).max(100).optional(),
          status: status.optional(),
          tags: z4.array(z4.string().trim().min(1)).optional(),
          outline: z4.string().optional(),
          platform: platform.optional(),
          publishedUrl: z4.string().url().nullable().optional()
        })
      ).mutation(async ({ ctx, input }) => {
        const { id, tags, ...rest } = input;
        const updated = await updateIdea(id, ctx.user.id, {
          ...rest,
          ...tags ? { tags: JSON.stringify(tags) } : {}
        });
        if (!updated) {
          throw new TRPCError7({
            code: "NOT_FOUND",
            message: "That idea no longer exists."
          });
        }
        return updated;
      }),
      /**
       * Marks a piece as shipped. This is the moment the app exists for, so it
       * records where and when rather than just flipping a status — the shelf is
       * only interesting if it remembers the details.
       */
      markShipped: protectedProcedure.input(
        z4.object({
          id: z4.number().int().positive(),
          url: z4.string().trim().url("That doesn't look like a link.").nullable().optional(),
          publishedIn: z4.string().trim().max(100).optional(),
          publishedAt: z4.date().optional()
        })
      ).mutation(async ({ ctx, input }) => {
        const updated = await updateIdea(input.id, ctx.user.id, {
          status: "published",
          publishedUrl: input.url ?? null,
          publishedIn: input.publishedIn || null,
          publishedAt: input.publishedAt ?? /* @__PURE__ */ new Date()
        });
        if (!updated) {
          throw new TRPCError7({
            code: "NOT_FOUND",
            message: "That idea no longer exists."
          });
        }
        return updated;
      }),
      /** Takes a piece back off the shelf, e.g. when a link was wrong. */
      unmarkShipped: protectedProcedure.input(z4.object({ id: z4.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const updated = await updateIdea(input.id, ctx.user.id, {
          status: "completed",
          publishedAt: null
        });
        if (!updated) {
          throw new TRPCError7({
            code: "NOT_FOUND",
            message: "That idea no longer exists."
          });
        }
        return updated;
      }),
      /** Moves to the bin. Undoable from the toast, or from the bin later. */
      delete: protectedProcedure.input(z4.object({ id: z4.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const deleted = await softDeleteIdea(input.id, ctx.user.id);
        if (!deleted) {
          throw new TRPCError7({
            code: "NOT_FOUND",
            message: "That idea no longer exists."
          });
        }
        return { success: true, id: input.id };
      }),
      listArchived: protectedProcedure.query(
        ({ ctx }) => listArchivedIdeas(ctx.user.id)
      ),
      /**
       * Archive and unarchive share one procedure: the caller says what state it
       * wants rather than which direction to move, so an undo is the same call
       * with the flag flipped.
       */
      setArchived: protectedProcedure.input(
        z4.object({ id: z4.number().int().positive(), archived: z4.boolean() })
      ).mutation(async ({ ctx, input }) => {
        const updated = await setIdeaArchived(
          input.id,
          ctx.user.id,
          input.archived
        );
        if (!updated) {
          throw new TRPCError7({
            code: "NOT_FOUND",
            message: "That idea no longer exists."
          });
        }
        return { success: true, id: input.id, archived: input.archived };
      }),
      restore: protectedProcedure.input(z4.object({ id: z4.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const restored = await restoreIdea(input.id, ctx.user.id);
        if (!restored) {
          throw new TRPCError7({
            code: "NOT_FOUND",
            message: "That idea is gone for good."
          });
        }
        return restored;
      }),
      deleteForever: protectedProcedure.input(z4.object({ id: z4.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const deleted = await deleteIdea(input.id, ctx.user.id);
        if (!deleted) {
          throw new TRPCError7({
            code: "NOT_FOUND",
            message: "That idea no longer exists."
          });
        }
        return { success: true };
      }),
      /** Empties the bin for good — the only irreversible bulk action in the app. */
      emptyTrash: protectedProcedure.mutation(async ({ ctx }) => {
        const purged = await purgeTrash(ctx.user.id);
        return { purged };
      }),
      listResearch: protectedProcedure.input(z4.object({ ideaId: z4.number().int().positive() })).query(({ ctx, input }) => listResearch(input.ideaId, ctx.user.id)),
      addResearch: protectedProcedure.input(
        z4.object({
          ideaId: z4.number().int().positive(),
          title: z4.string().trim().min(1).max(200),
          url: z4.string().url().optional(),
          notes: z4.string().trim().max(2e3).optional(),
          source: z4.enum(RESEARCH_SOURCES).optional()
        })
      ).mutation(async ({ ctx, input }) => {
        const idea = await getIdea(input.ideaId, ctx.user.id);
        if (!idea) {
          throw new TRPCError7({
            code: "NOT_FOUND",
            message: "That idea no longer exists."
          });
        }
        return addResearch({ ...input, userId: ctx.user.id });
      }),
      deleteResearch: protectedProcedure.input(z4.object({ researchId: z4.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const deleted = await deleteResearch(input.researchId, ctx.user.id);
        if (!deleted) {
          throw new TRPCError7({
            code: "NOT_FOUND",
            message: "That note no longer exists."
          });
        }
        return { success: true };
      })
    });
  }
});

// server/routers/profile.ts
import { TRPCError as TRPCError8 } from "@trpc/server";
import { z as z5 } from "zod";
var username, RESERVED, profileRouter;
var init_profile = __esm({
  "server/routers/profile.ts"() {
    "use strict";
    init_trpc();
    init_db();
    username = z5.string().trim().toLowerCase().min(2, "At least 2 characters.").max(30, "At most 30 characters.").regex(
      /^[a-z0-9][a-z0-9_-]*$/,
      "Letters, numbers, hyphens and underscores only."
    );
    RESERVED = /* @__PURE__ */ new Set([
      "admin",
      "api",
      "signin",
      "signup",
      "settings",
      "ideas",
      "thoughts",
      "discover",
      "search",
      "shipped",
      "trash",
      "about",
      "privacy",
      "terms",
      "reset-password",
      "support",
      "help"
    ]);
    profileRouter = router({
      /** The signed-in user's own profile, including fields `auth.me` doesn't carry. */
      mine: protectedProcedure.query(async ({ ctx }) => {
        const user = await findUserById(ctx.user.id);
        if (!user) {
          throw new TRPCError8({ code: "NOT_FOUND", message: "Account not found." });
        }
        return toPublicUser(user);
      }),
      update: protectedProcedure.input(
        z5.object({
          name: z5.string().trim().min(1).max(80).optional(),
          bio: z5.string().trim().max(280).optional(),
          username: username.nullable().optional(),
          publicProfile: z5.boolean().optional()
        })
      ).mutation(async ({ ctx, input }) => {
        if (input.username) {
          if (RESERVED.has(input.username)) {
            throw new TRPCError8({
              code: "CONFLICT",
              message: "That handle is reserved. Try another."
            });
          }
          const existing = await findUserByUsername(input.username);
          if (existing && existing.id !== ctx.user.id) {
            throw new TRPCError8({
              code: "CONFLICT",
              message: "That handle is taken."
            });
          }
        }
        if (input.publicProfile) {
          const current = await findUserById(ctx.user.id);
          if (!input.username && !current?.username) {
            throw new TRPCError8({
              code: "BAD_REQUEST",
              message: "Claim a handle before making your shelf public."
            });
          }
          if (current?.demoExpiresAt) {
            throw new TRPCError8({
              code: "FORBIDDEN",
              message: "Make a real account to publish a shelf."
            });
          }
        }
        const updated = await updateProfile(ctx.user.id, input);
        return toPublicUser(updated);
      }),
      /**
       * The public shelf at `/@handle`. Anonymous — no session required — and
       * returns only what the owner chose to publish: title, blurb, link, date.
       * Draft prose is never exposed here.
       */
      publicShelf: publicProcedure.input(z5.object({ username: z5.string().trim().min(1).max(30) })).query(async ({ input }) => {
        const user = await findUserByUsername(input.username);
        if (!user || !user.publicProfile || !user.username) {
          throw new TRPCError8({ code: "NOT_FOUND", message: "No shelf here." });
        }
        const published = await listPublishedIdeas(user.id);
        return {
          name: user.name,
          username: user.username,
          bio: user.bio,
          memberSince: user.createdAt,
          totalWords: published.reduce((sum, idea) => sum + idea.wordCount, 0),
          pieces: published.map((idea) => ({
            id: idea.id,
            title: idea.title,
            description: idea.description,
            category: idea.category,
            url: idea.publishedUrl,
            publishedIn: idea.publishedIn,
            publishedAt: idea.publishedAt,
            wordCount: idea.wordCount
          }))
        };
      })
    });
  }
});

// shared/streak.ts
function toDayKeyInZone(date, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }
}
function toDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function shiftDays(dayKey, delta) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + delta);
  return toDayKey(date);
}
function daysBetween(from, to) {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  return Math.round((end - start) / 864e5);
}
function calculateStreak(writingDays, today) {
  if (writingDays.length === 0) return 0;
  const days = new Set(writingDays);
  let cursor;
  if (days.has(today)) {
    cursor = today;
  } else if (days.has(shiftDays(today, -1))) {
    cursor = shiftDays(today, -1);
  } else {
    return 0;
  }
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftDays(cursor, -1);
  }
  return streak;
}
function daysSinceLastWrote(writingDays, today) {
  if (writingDays.length === 0) return null;
  const mostRecent = writingDays.reduce((a, b) => a > b ? a : b);
  return Math.max(0, daysBetween(mostRecent, today));
}
function habitMessage(daysSince, streak) {
  if (daysSince === null)
    return "Nothing written yet. The first line is the hard one.";
  if (streak >= 7) return `${streak} days running. This is a habit now.`;
  if (daysSince === 0)
    return streak > 1 ? `Day ${streak}. Keep it going.` : "Wrote today. Good.";
  if (daysSince === 1) return "Wrote yesterday. Pick it back up.";
  if (daysSince <= 6) return `${daysSince} days since you last wrote.`;
  if (daysSince <= 30)
    return `It's been ${daysSince} days. Start small \u2014 one paragraph.`;
  return "It's been a while. Open a draft and write one bad sentence.";
}
var init_streak = __esm({
  "shared/streak.ts"() {
    "use strict";
  }
});

// shared/prompts.ts
function build(kind, texts) {
  return texts.map((text2, index2) => ({
    id: `${kind}-${index2 + 1}`,
    text: text2,
    kind
  }));
}
function promptOfTheDay(dayKey, pool = CURATED_PROMPTS) {
  if (pool.length === 0) return null;
  let hash = 0;
  for (let index2 = 0; index2 < dayKey.length; index2++) {
    hash = hash * 31 + dayKey.charCodeAt(index2) | 0;
  }
  return pool[Math.abs(hash) % pool.length];
}
var CURATED_PROMPTS;
var init_prompts = __esm({
  "shared/prompts.ts"() {
    "use strict";
    CURATED_PROMPTS = [
      ...build("technical", [
        "Explain a complex concept you recently learned, to someone one step behind you",
        "Break down a system architecture you find genuinely beautiful",
        "A production issue you debugged, and what it taught you about the system",
        "Compare two technologies you've used in anger \u2014 not from the docs",
        "The thing everyone gets wrong about your specialty",
        "Build a feature from scratch, narrating every decision you make",
        "A bug that took days and turned out to be one character",
        "The abstraction you regret introducing",
        "What your monitoring doesn't tell you",
        "A technical concept explained without a single piece of jargon"
      ]),
      ...build("reflection", [
        "A lesson you learned the hard way",
        "What you wish you'd known when you started",
        "A mistake that changed how you work",
        "The moment you realised you'd outgrown a role",
        "How your relationship with work has shifted",
        "Something you believed strongly and no longer do",
        "The advice you were given that turned out to be wrong",
        "A conversation that stuck with you, and why",
        "A letter to yourself three years ago",
        "The part of your job nobody warned you about"
      ]),
      ...build("creative", [
        "Where design and engineering disagree, and who is usually right",
        "A piece of art that changed how you think about your craft",
        "Apply a principle from one discipline to a problem in another",
        "The aesthetics of something nobody finds beautiful",
        "A creative project that failed interestingly",
        "What music and systems have in common",
        "The most elegant thing you saw this year, in any field",
        "Something ordinary, described as if you'd never seen it before"
      ]),
      ...build("short", [
        "One thing you learned today, in 100 words",
        "A hot take you can defend in 400 words",
        "Something you noticed this week",
        "A small thing that makes a disproportionate difference",
        "The industry convention that makes no sense to you",
        "Three unrelated things that turned out to be related",
        "What nobody talks about",
        "The most useful tool you found this year, and why"
      ]),
      ...build("analysis", [
        "A deep dive into a trend you're sceptical of",
        "What the data actually says, versus what everyone repeats",
        "A case study worth dissecting",
        "Trace one decision through to all its downstream consequences",
        "The strongest version of an argument you disagree with",
        "Something that worked, and an honest account of why"
      ]),
      ...build("constraint", [
        "Write 200 words without using the word 'I'",
        "Explain your last project in exactly three paragraphs",
        "Write the ending first, then work backwards",
        "One page, no adjectives",
        "Write it as a letter to a specific person",
        "Start with the most boring sentence you can, then earn the reader back",
        "Write the version you'd be embarrassed to publish, then keep the true parts",
        "Set a timer for fifteen minutes and don't stop typing",
        "Explain it to someone who is smart but has no context at all",
        "Write only the questions. Answer none of them."
      ])
    ];
  }
});

// server/routers/prompts.ts
import { TRPCError as TRPCError9 } from "@trpc/server";
import { z as z6 } from "zod";
var promptsRouter;
var init_prompts2 = __esm({
  "server/routers/prompts.ts"() {
    "use strict";
    init_streak();
    init_prompts();
    init_trpc();
    init_db();
    promptsRouter = router({
      list: protectedProcedure.query(async ({ ctx }) => {
        const mine = await listPrompts(ctx.user.id);
        const all = [
          ...CURATED_PROMPTS.map((prompt) => ({ ...prompt, own: false, dbId: null })),
          ...mine.map((prompt) => ({
            id: `own-${prompt.id}`,
            text: prompt.text,
            kind: prompt.kind,
            own: true,
            dbId: prompt.id
          }))
        ];
        return {
          prompts: all,
          /** Same prompt all day, on every device. */
          today: promptOfTheDay(toDayKey(/* @__PURE__ */ new Date()), all)
        };
      }),
      create: protectedProcedure.input(
        z6.object({
          text: z6.string().trim().min(1, "Write the prompt first.").max(300),
          kind: z6.string().trim().min(1).max(40).default("general")
        })
      ).mutation(
        ({ ctx, input }) => createPrompt({ userId: ctx.user.id, text: input.text, kind: input.kind })
      ),
      /** Only ever deletes the user's own rows — curated prompts have no owner. */
      delete: protectedProcedure.input(z6.object({ id: z6.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const deleted = await deletePrompt(input.id, ctx.user.id);
        if (!deleted) {
          throw new TRPCError9({
            code: "NOT_FOUND",
            message: "That prompt isn't yours to delete."
          });
        }
        return { success: true };
      })
    });
  }
});

// server/routers/reminders.ts
import { z as z7 } from "zod";
var remindersRouter;
var init_reminders3 = __esm({
  "server/routers/reminders.ts"() {
    "use strict";
    init_domain();
    init_env();
    init_push();
    init_trpc();
    init_db();
    remindersRouter = router({
      /** Public: the sign-in page has no session but the client needs the key. */
      config: publicProcedure.query(() => ({
        enabled: pushEnabled(),
        publicKey: ENV.vapidPublicKey
      })),
      settings: protectedProcedure.query(async ({ ctx }) => {
        const [preferences, subscriptions] = await Promise.all([
          getPreferences(ctx.user.id),
          countPushSubscriptions(ctx.user.id)
        ]);
        return {
          frequency: preferences.reminderFrequency,
          time: preferences.reminderTime,
          days: preferences.reminderDays ? JSON.parse(preferences.reminderDays) : [],
          timeZone: preferences.timeZone,
          /** How many browsers are listening — 0 means nothing will arrive. */
          devices: subscriptions
        };
      }),
      update: protectedProcedure.input(
        z7.object({
          frequency: z7.enum(REMINDER_FREQUENCIES),
          /** "HH:MM", 24-hour. */
          time: z7.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 09:00."),
          days: z7.array(z7.number().int().min(0).max(31)).max(31),
          timeZone: z7.string().min(1).max(64)
        })
      ).mutation(async ({ ctx, input }) => {
        await updatePreferences(ctx.user.id, {
          reminderFrequency: input.frequency,
          reminderTime: input.time,
          reminderDays: JSON.stringify(input.days),
          timeZone: input.timeZone
        });
        return { success: true };
      }),
      /** Registers this browser. Called after the user grants permission. */
      subscribe: protectedProcedure.input(
        z7.object({
          endpoint: z7.string().url().max(1e3),
          p256dh: z7.string().min(1).max(200),
          auth: z7.string().min(1).max(200)
        })
      ).mutation(async ({ ctx, input }) => {
        await savePushSubscription({ userId: ctx.user.id, ...input });
        return { success: true };
      }),
      unsubscribe: protectedProcedure.input(z7.object({ endpoint: z7.string().max(1e3) })).mutation(async ({ input }) => {
        await deletePushSubscription(input.endpoint);
        return { success: true };
      }),
      /**
       * Sends one immediately, so someone can confirm notifications actually
       * arrive on this device before trusting the schedule with their habit.
       */
      test: protectedProcedure.mutation(async ({ ctx }) => {
        const subscriptions = await listPushSubscriptions(ctx.user.id);
        if (subscriptions.length === 0) {
          return { sent: 0, message: "No browser is subscribed yet." };
        }
        let sent = 0;
        for (const subscription of subscriptions) {
          const result = await sendPush(subscription, {
            title: "This is what a reminder looks like",
            body: "Quiet, and easy to turn off in Settings.",
            url: `${ENV.appUrl}/`
          });
          if (result === "gone")
            await deletePushSubscription(subscription.endpoint);
          if (result === "sent") sent += 1;
        }
        return { sent, message: sent > 0 ? "Sent." : "Couldn't deliver." };
      })
    });
  }
});

// server/routers/search.ts
import { z as z8 } from "zod";
var searchRouter;
var init_search2 = __esm({
  "server/routers/search.ts"() {
    "use strict";
    init_domain();
    init_trpc();
    init_db();
    searchRouter = router({
      /**
       * One query across ideas, thoughts and draft prose, ranked by relevance
       * rather than date. Short terms return nothing rather than everything — a
       * single letter matching the whole library is noise, not a result.
       */
      query: protectedProcedure.input(
        z8.object({
          term: z8.string().trim().max(200),
          kinds: z8.array(z8.enum(["idea", "thought", "draft"])).optional(),
          status: z8.enum(IDEA_STATUSES).optional(),
          category: z8.string().max(100).optional(),
          /** Days back; omitted means all time. */
          withinDays: z8.number().int().positive().max(3650).optional()
        })
      ).query(({ ctx, input }) => {
        if (input.term.length < 2) return [];
        return search(ctx.user.id, input.term, {
          kinds: input.kinds,
          status: input.status,
          category: input.category,
          since: input.withinDays ? new Date(Date.now() - input.withinDays * 864e5) : void 0
        });
      }),
      /** The categories a filter can offer, so the UI never invents one. */
      facets: protectedProcedure.query(async ({ ctx }) => ({
        categories: (await listCategories(ctx.user.id)).map((c) => c.name)
      }))
    });
  }
});

// server/routers/stats.ts
import { z as z9 } from "zod";
var statsRouter;
var init_stats = __esm({
  "server/routers/stats.ts"() {
    "use strict";
    init_streak();
    init_trpc();
    init_db();
    statsRouter = router({
      /** Everything the dashboard needs, in one round trip. */
      dashboard: protectedProcedure.input(z9.object({ timeZone: z9.string().max(64).optional() }).optional()).query(async ({ ctx, input }) => {
        const timeZone = input?.timeZone || "UTC";
        const [
          ideas2,
          drafts2,
          thoughts,
          unlinked,
          published,
          sessionTimes,
          preferences
        ] = await Promise.all([
          listIdeas(ctx.user.id),
          listDrafts(ctx.user.id),
          listThoughts(ctx.user.id),
          listUnlinkedThoughts(ctx.user.id),
          listPublishedIdeas(ctx.user.id),
          listWritingSessionTimes(ctx.user.id),
          getPreferences(ctx.user.id)
        ]);
        const today = toDayKeyInZone(/* @__PURE__ */ new Date(), timeZone);
        const days = [
          ...new Set(
            sessionTimes.map((s) => toDayKeyInZone(s.startedAt, timeZone))
          )
        ];
        const wordsToday = sessionTimes.filter((s) => toDayKeyInZone(s.startedAt, timeZone) === today).reduce((sum, s) => sum + s.wordsWritten, 0);
        const streak = calculateStreak(days, today);
        const daysSince = daysSinceLastWrote(days, today);
        const byStatus = ideas2.reduce((acc, idea) => {
          acc[idea.status] = (acc[idea.status] ?? 0) + 1;
          return acc;
        }, {});
        const thisYear = (/* @__PURE__ */ new Date()).getFullYear();
        return {
          totals: {
            ideas: ideas2.length,
            thoughts: thoughts.length,
            /** Thoughts with nowhere to go yet — the pile worth sorting. */
            unlinkedThoughts: unlinked.length,
            drafts: drafts2.length,
            published: published.length,
            inProgress: (byStatus["in-progress"] ?? 0) + (byStatus.outline ?? 0),
            words: drafts2.reduce((sum, draft) => sum + draft.wordCount, 0),
            /** Words that actually went out this year — the number worth showing off. */
            wordsPublishedThisYear: published.filter((idea) => idea.publishedAt?.getFullYear() === thisYear).reduce((sum, idea) => sum + idea.wordCount, 0)
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
          resume: ideas2.find((idea) => idea.status !== "published") ?? null,
          /** Most recently touched ideas, for the "pick up where you left off" list. */
          recentIdeas: ideas2.slice(0, 5),
          /** The last few things shipped, for the dashboard's shelf preview. */
          recentlyShipped: published.slice(0, 3)
        };
      })
    });
  }
});

// server/routers/thoughts.ts
import { TRPCError as TRPCError10 } from "@trpc/server";
import { z as z10 } from "zod";
var thoughtIds, thoughtsRouter;
var init_thoughts = __esm({
  "server/routers/thoughts.ts"() {
    "use strict";
    init_trpc();
    init_db();
    thoughtIds = z10.array(z10.number().int().positive()).min(1).max(50);
    thoughtsRouter = router({
      list: protectedProcedure.query(({ ctx }) => listThoughts(ctx.user.id)),
      /** Thoughts with no idea attached yet — the merge candidates. */
      listUnlinked: protectedProcedure.query(
        ({ ctx }) => listUnlinkedThoughts(ctx.user.id)
      ),
      /** The side rail in the editor: everything feeding this one idea. */
      listForIdea: protectedProcedure.input(z10.object({ ideaId: z10.number().int().positive() })).query(({ ctx, input }) => listThoughtsForIdea(input.ideaId, ctx.user.id)),
      listDeleted: protectedProcedure.query(
        ({ ctx }) => listDeletedThoughts(ctx.user.id)
      ),
      /** The capture box. Deliberately minimal — content is the only requirement. */
      create: protectedProcedure.input(
        z10.object({
          content: z10.string().trim().min(1, "Write something first.").max(5e3),
          tags: z10.array(z10.string().trim().min(1).max(40)).max(10).optional()
        })
      ).mutation(
        ({ ctx, input }) => createThought({
          userId: ctx.user.id,
          content: input.content,
          tags: input.tags?.length ? JSON.stringify(input.tags) : null
        })
      ),
      update: protectedProcedure.input(
        z10.object({
          id: z10.number().int().positive(),
          content: z10.string().trim().min(1).max(5e3).optional(),
          tags: z10.array(z10.string().trim().min(1).max(40)).max(10).optional()
        })
      ).mutation(async ({ ctx, input }) => {
        const { id, tags, ...rest } = input;
        const updated = await updateThought(id, ctx.user.id, {
          ...rest,
          ...tags ? { tags: JSON.stringify(tags) } : {}
        });
        if (!updated) {
          throw new TRPCError10({
            code: "NOT_FOUND",
            message: "That thought no longer exists."
          });
        }
        return updated;
      }),
      /**
       * Promotes a single raw thought into a full idea, keeping the thought linked
       * so the original wording isn't lost.
       */
      promoteToIdea: protectedProcedure.input(
        z10.object({
          id: z10.number().int().positive(),
          title: z10.string().trim().min(1).max(200),
          category: z10.string().trim().min(1).max(100)
        })
      ).mutation(async ({ ctx, input }) => {
        const [thought] = await getThoughtsByIds([input.id], ctx.user.id);
        if (!thought) {
          throw new TRPCError10({
            code: "NOT_FOUND",
            message: "That thought no longer exists."
          });
        }
        const idea = await createIdea({
          userId: ctx.user.id,
          title: input.title,
          description: thought.content,
          category: input.category,
          status: "draft"
        });
        await linkThoughtsToIdea([thought.id], idea.id, ctx.user.id);
        return idea;
      }),
      /**
       * The forge: several scattered thoughts become one idea.
       *
       * The thoughts stay put and stay linked rather than being consumed — the pile
       * is a record of how the piece came together, and the editor's side rail
       * reads from exactly this link.
       */
      mergeIntoIdea: protectedProcedure.input(
        z10.object({
          ids: thoughtIds,
          title: z10.string().trim().min(1, "Give the idea a title.").max(200),
          category: z10.string().trim().min(1, "Pick a category.").max(100)
        })
      ).mutation(async ({ ctx, input }) => {
        const thoughts = await getThoughtsByIds(input.ids, ctx.user.id);
        if (thoughts.length === 0) {
          throw new TRPCError10({
            code: "NOT_FOUND",
            message: "Those thoughts no longer exist."
          });
        }
        const idea = await createIdea({
          userId: ctx.user.id,
          title: input.title,
          description: `Built from ${thoughts.length} thought${thoughts.length === 1 ? "" : "s"}.`,
          category: input.category,
          status: "draft"
        });
        await linkThoughtsToIdea(
          thoughts.map((thought) => thought.id),
          idea.id,
          ctx.user.id
        );
        return { idea, merged: thoughts.length };
      }),
      /** Attach or detach thoughts from an idea, from the editor's side rail. */
      link: protectedProcedure.input(
        z10.object({
          ids: thoughtIds,
          ideaId: z10.number().int().positive().nullable()
        })
      ).mutation(async ({ ctx, input }) => {
        const linked = await linkThoughtsToIdea(
          input.ids,
          input.ideaId,
          ctx.user.id
        );
        return { linked };
      }),
      /** Moves to the bin. Undoable from the toast, or from the bin later. */
      delete: protectedProcedure.input(z10.object({ id: z10.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const deleted = await softDeleteThought(input.id, ctx.user.id);
        if (!deleted) {
          throw new TRPCError10({
            code: "NOT_FOUND",
            message: "That thought no longer exists."
          });
        }
        return { success: true, id: input.id };
      }),
      listArchived: protectedProcedure.query(
        ({ ctx }) => listArchivedThoughts(ctx.user.id)
      ),
      /** Same shape as the ideas router: state, not direction, so undo is trivial. */
      setArchived: protectedProcedure.input(
        z10.object({ id: z10.number().int().positive(), archived: z10.boolean() })
      ).mutation(async ({ ctx, input }) => {
        const updated = await setThoughtArchived(
          input.id,
          ctx.user.id,
          input.archived
        );
        if (!updated) {
          throw new TRPCError10({
            code: "NOT_FOUND",
            message: "That thought no longer exists."
          });
        }
        return { success: true, id: input.id, archived: input.archived };
      }),
      restore: protectedProcedure.input(z10.object({ id: z10.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const restored = await restoreThought(input.id, ctx.user.id);
        if (!restored) {
          throw new TRPCError10({
            code: "NOT_FOUND",
            message: "That thought is gone for good."
          });
        }
        return restored;
      }),
      deleteForever: protectedProcedure.input(z10.object({ id: z10.number().int().positive() })).mutation(async ({ ctx, input }) => {
        const deleted = await deleteThought(input.id, ctx.user.id);
        if (!deleted) {
          throw new TRPCError10({
            code: "NOT_FOUND",
            message: "That thought no longer exists."
          });
        }
        return { success: true };
      })
    });
  }
});

// server/routers.ts
var appRouter;
var init_routers = __esm({
  "server/routers.ts"() {
    "use strict";
    init_trpc();
    init_account();
    init_auth2();
    init_categories();
    init_drafts();
    init_ideas();
    init_profile();
    init_prompts2();
    init_reminders3();
    init_search2();
    init_stats();
    init_thoughts();
    appRouter = router({
      health: publicProcedure.query(() => ({
        ok: true,
        at: (/* @__PURE__ */ new Date()).toISOString()
      })),
      auth: authRouter,
      account: accountRouter,
      ideas: ideasRouter,
      categories: categoriesRouter,
      drafts: draftsRouter,
      thoughts: thoughtsRouter,
      stats: statsRouter,
      prompts: promptsRouter,
      reminders: remindersRouter,
      profile: profileRouter,
      search: searchRouter
    });
  }
});

// server/app.ts
var app_exports = {};
__export(app_exports, {
  createApp: () => createApp
});
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
function createApp() {
  const app2 = express();
  app2.set("trust proxy", 1);
  app2.use(express.json({ limit: "5mb" }));
  app2.use(express.urlencoded({ limit: "5mb", extended: true }));
  app2.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  mountErrorReporting(app2);
  mountCron(app2);
  mountGoogleAuth(app2);
  mountPublicShelf(app2);
  app2.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path: path2 }) {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          report({
            source: "server",
            message: error.message,
            stack: (error.cause instanceof Error ? error.cause : error).stack,
            at: path2 ?? "<no path>"
          });
        }
      }
    })
  );
  return app2;
}
var init_app = __esm({
  "server/app.ts"() {
    "use strict";
    init_observability();
    init_observability();
    init_context();
    init_googleAuth();
    init_cron();
    init_publicShelf();
    init_routers();
  }
});

// server/serverless.ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
var shell = null;
function readShell() {
  if (shell !== null) return shell;
  const candidates = [
    path.join(process.cwd(), "dist/public/index.html"),
    path.join(process.cwd(), "public/index.html")
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  shell = found ? fs.readFileSync(found, "utf-8") : "<!doctype html><html></html>";
  return shell;
}
var app = null;
var initError = null;
var started = false;
async function ensureApp() {
  if (started) return;
  started = true;
  try {
    const [{ createApp: createApp2 }, { injectShelfMeta: injectShelfMeta2 }] = await Promise.all([
      Promise.resolve().then(() => (init_app(), app_exports)),
      Promise.resolve().then(() => (init_publicShelf(), publicShelf_exports))
    ]);
    const built = createApp2();
    built.use((_req, res) => {
      const meta = res.locals.shelfMeta;
      const html = readShell();
      res.status(200).type("html").send(meta ? injectShelfMeta2(html, meta) : html);
    });
    app = built;
  } catch (error) {
    initError = error instanceof Error ? error : new Error(String(error));
    console.error("[boot] failed to build the app:", initError);
  }
}
function bootFailure(res) {
  res.statusCode = 500;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "The server is misconfigured." }));
}
async function handler(req, res) {
  await ensureApp();
  if (!app) {
    bootFailure(res);
    return;
  }
  app(req, res);
}
export {
  handler as default
};
