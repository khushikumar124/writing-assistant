import { beforeEach, describe, expect, it } from "vitest";

/**
 * Router tests against a real database.
 *
 * These exercise the actual procedures rather than mocking the data layer,
 * because the bugs worth catching here are the ones that live at the seam:
 * ownership checks, cascade behaviour, and validation. A mocked db would have
 * happily passed while leaking another account's writing.
 *
 * A fresh temp file per run, so the tests never touch the dev database.
 */
process.env.DATABASE_URL = `/tmp/wa-test-${process.pid}.db`;
process.env.SESSION_SECRET = "test-secret";
process.env.DEMO_MODE = "true";

const { migrateToLatest } = await import("../migrate");
const db = await import("../db");
const { appRouter } = await import("../routers");

await migrateToLatest();

/** A caller acting as `userId`, with the cookie plumbing stubbed out. */
function callerFor(userId: number) {
  return appRouter.createCaller({
    req: { headers: {}, ip: "127.0.0.1" } as never,
    res: { cookie: () => {}, clearCookie: () => {} } as never,
    user: { id: userId } as never,
  });
}

let alice = 0;
let bob = 0;

beforeEach(async () => {
  const stamp = `${Date.now()}-${Math.random()}`;
  alice = (
    await db.createGoogleUser({
      email: `alice-${stamp}@example.com`,
      googleId: `g-alice-${stamp}`,
    })
  ).id;
  bob = (
    await db.createGoogleUser({
      email: `bob-${stamp}@example.com`,
      googleId: `g-bob-${stamp}`,
    })
  ).id;
});

describe("thoughts", () => {
  it("captures and lists a thought", async () => {
    const caller = callerFor(alice);
    await caller.thoughts.create({ content: "a caught thought", tags: ["x"] });

    const list = await caller.thoughts.list();
    expect(list).toHaveLength(1);
    expect(list[0].content).toBe("a caught thought");
  });

  it("rejects an empty thought", async () => {
    await expect(
      callerFor(alice).thoughts.create({ content: "   " })
    ).rejects.toThrow();
  });

  it("never returns another account's thoughts", async () => {
    await callerFor(alice).thoughts.create({ content: "alice's private note" });
    expect(await callerFor(bob).thoughts.list()).toHaveLength(0);
  });

  it("cannot delete another account's thought", async () => {
    const mine = await callerFor(alice).thoughts.create({ content: "mine" });
    await expect(
      callerFor(bob).thoughts.delete({ id: mine.id })
    ).rejects.toThrow();
    // And it is still there afterwards.
    expect(await callerFor(alice).thoughts.list()).toHaveLength(1);
  });

  it("merges several thoughts into one idea and keeps them linked", async () => {
    const caller = callerFor(alice);
    const first = await caller.thoughts.create({ content: "one" });
    const second = await caller.thoughts.create({ content: "two" });

    const result = await caller.thoughts.mergeIntoIdea({
      ids: [first.id, second.id],
      title: "Forged",
      category: "General",
    });

    expect(result.merged).toBe(2);
    const rail = await caller.thoughts.listForIdea({ ideaId: result.idea.id });
    expect(rail).toHaveLength(2);
    // Linked thoughts are no longer loose.
    expect(await caller.thoughts.listUnlinked()).toHaveLength(0);
  });

  it("will not merge thoughts belonging to someone else", async () => {
    const hers = await callerFor(alice).thoughts.create({ content: "hers" });
    await expect(
      callerFor(bob).thoughts.mergeIntoIdea({
        ids: [hers.id],
        title: "Stolen",
        category: "General",
      })
    ).rejects.toThrow();
  });
});

describe("ideas", () => {
  it("soft deletes to the bin, then restores", async () => {
    const caller = callerFor(alice);
    const idea = await caller.ideas.create({
      title: "Draft",
      category: "General",
    });

    await caller.ideas.delete({ id: idea.id });
    expect(await caller.ideas.list()).toHaveLength(0);
    expect(await caller.ideas.listDeleted()).toHaveLength(1);

    await caller.ideas.restore({ id: idea.id });
    expect(await caller.ideas.list()).toHaveLength(1);
  });

  it("records where and when a piece shipped", async () => {
    const caller = callerFor(alice);
    const idea = await caller.ideas.create({
      title: "Piece",
      category: "General",
    });

    await caller.ideas.markShipped({
      id: idea.id,
      url: "https://example.com/piece",
      publishedIn: "Substack",
    });

    const shelf = await caller.ideas.listPublished();
    expect(shelf).toHaveLength(1);
    expect(shelf[0].publishedIn).toBe("Substack");
    expect(shelf[0].publishedAt).toBeInstanceOf(Date);
  });

  it("rejects a shipped link that isn't a URL", async () => {
    const caller = callerFor(alice);
    const idea = await caller.ideas.create({
      title: "Piece",
      category: "General",
    });
    await expect(
      caller.ideas.markShipped({ id: idea.id, url: "not a url" })
    ).rejects.toThrow();
  });

  it("cannot read another account's idea", async () => {
    const idea = await callerFor(alice).ideas.create({
      title: "Private",
      category: "General",
    });
    await expect(callerFor(bob).ideas.get({ id: idea.id })).rejects.toThrow();
  });
});

describe("profile and the public shelf", () => {
  it("keeps a shelf private until it is published", async () => {
    const caller = callerFor(alice);
    await caller.profile.update({ username: "alice-shelf" });

    // Handle claimed, but publicProfile is still false.
    await expect(
      appRouter
        .createCaller({ req: {} as never, res: {} as never, user: null })
        .profile.publicShelf({ username: "alice-shelf" })
    ).rejects.toThrow();
  });

  it("refuses a handle someone else already has", async () => {
    await callerFor(alice).profile.update({ username: "taken" });
    await expect(
      callerFor(bob).profile.update({ username: "taken" })
    ).rejects.toThrow();
  });

  it("refuses a reserved handle", async () => {
    await expect(
      callerFor(alice).profile.update({ username: "settings" })
    ).rejects.toThrow();
  });

  it("will not make a shelf public without a handle", async () => {
    await expect(
      callerFor(bob).profile.update({ publicProfile: true })
    ).rejects.toThrow();
  });

  it("exposes only published pieces on a public shelf", async () => {
    const caller = callerFor(alice);
    const shipped = await caller.ideas.create({
      title: "Out in the world",
      category: "General",
    });
    await caller.ideas.markShipped({ id: shipped.id });
    await caller.ideas.create({ title: "Still a draft", category: "General" });

    await caller.profile.update({ username: "alice-pub", publicProfile: true });

    const shelf = await appRouter
      .createCaller({ req: {} as never, res: {} as never, user: null })
      .profile.publicShelf({ username: "alice-pub" });

    expect(shelf.pieces).toHaveLength(1);
    expect(shelf.pieces[0].title).toBe("Out in the world");
  });
});

describe("account deletion", () => {
  it("refuses a confirmation that doesn't match", async () => {
    await expect(
      callerFor(alice).account.delete({ confirmation: "DELETE" })
    ).rejects.toThrow();
    expect(await db.findUserById(alice)).toBeDefined();
  });

  it("erases the account and everything hanging off it", async () => {
    const caller = callerFor(alice);
    await caller.thoughts.create({ content: "goes away" });
    const idea = await caller.ideas.create({
      title: "Also goes",
      category: "General",
    });
    await caller.drafts.save({ ideaId: idea.id, content: "prose" });

    const user = await db.findUserById(alice);
    await caller.account.delete({ confirmation: user!.email });

    expect(await db.findUserById(alice)).toBeUndefined();
    // Cascades leave nothing orphaned.
    expect(db.getRawDb().pragma("foreign_key_check")).toEqual([]);
  });
});

describe("drafts and streaks", () => {
  it("only counts words actually added", async () => {
    const caller = callerFor(alice);
    const idea = await caller.ideas.create({
      title: "Piece",
      category: "General",
    });

    await caller.drafts.save({ ideaId: idea.id, content: "one two three" });
    const afterFirst = await db.listWritingSessionTimes(alice);
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0].wordsWritten).toBe(3);

    // Re-saving the same text adds nothing, so it logs no session.
    await caller.drafts.save({ ideaId: idea.id, content: "one two three" });
    expect(await db.listWritingSessionTimes(alice)).toHaveLength(1);

    // Deleting words also logs nothing — a streak means "I wrote".
    await caller.drafts.save({ ideaId: idea.id, content: "one" });
    expect(await db.listWritingSessionTimes(alice)).toHaveLength(1);
  });
});
