import { describe, expect, it } from "vitest";
import { scoreMatch, type Scorable } from "./search";

const now = new Date("2026-08-05T12:00:00Z");
const recent = new Date("2026-08-05T09:00:00Z");
const old = new Date("2025-01-05T09:00:00Z");

const make = (over: Partial<Scorable>): Scorable => ({
  kind: "idea",
  title: "",
  body: "",
  updatedAt: recent,
  ...over,
});

describe("scoreMatch", () => {
  it("scores nothing when the term is absent", () => {
    expect(scoreMatch(make({ title: "Beekeeping" }), "database", now)).toBe(0);
  });

  it("ranks a title match above a body match", () => {
    const title = scoreMatch(
      make({ title: "Database indexes" }),
      "database",
      now
    );
    const body = scoreMatch(
      make({ title: "Something else", body: "a database somewhere" }),
      "database",
      now
    );
    expect(title).toBeGreaterThan(body);
  });

  it("ranks a whole-word match above one inside a longer word", () => {
    const word = scoreMatch(make({ body: "the art of it" }), "art", now);
    const partial = scoreMatch(make({ body: "just starting out" }), "art", now);
    expect(word).toBeGreaterThan(partial);
  });

  it("ranks an exact title above a title that merely contains the term", () => {
    const exact = scoreMatch(make({ title: "indexes" }), "indexes", now);
    const contains = scoreMatch(
      make({ title: "what I got wrong about indexes" }),
      "indexes",
      now
    );
    expect(exact).toBeGreaterThan(contains);
  });

  it("rewards the whole phrase over the same words scattered", () => {
    const phrase = scoreMatch(
      make({ body: "notes on database indexes here" }),
      "database indexes",
      now
    );
    const scattered = scoreMatch(
      make({ body: "a database, and separately some indexes" }),
      "database indexes",
      now
    );
    expect(phrase).toBeGreaterThan(scattered);
  });

  it("prefers recent items when relevance is otherwise equal", () => {
    const fresh = scoreMatch(
      make({ title: "Indexes", updatedAt: recent }),
      "indexes",
      now
    );
    const stale = scoreMatch(
      make({ title: "Indexes", updatedAt: old }),
      "indexes",
      now
    );
    expect(fresh).toBeGreaterThan(stale);
  });

  it("does not let recency beat a much stronger match", () => {
    // A year-old exact title should still outrank today's passing mention.
    const oldTitle = scoreMatch(
      make({ title: "Indexes", updatedAt: old }),
      "indexes",
      now
    );
    const freshBody = scoreMatch(
      make({
        title: "Unrelated",
        body: "mentions indexes once",
        updatedAt: recent,
      }),
      "indexes",
      now
    );
    expect(oldTitle).toBeGreaterThan(freshBody);
  });

  it("breaks ties toward the more deliberate object", () => {
    const idea = scoreMatch(
      make({ kind: "idea", body: "on indexes" }),
      "indexes",
      now
    );
    const thought = scoreMatch(
      make({ kind: "thought", body: "on indexes" }),
      "indexes",
      now
    );
    expect(idea).toBeGreaterThan(thought);
  });

  it("is case insensitive", () => {
    expect(
      scoreMatch(make({ title: "INDEXES" }), "indexes", now)
    ).toBeGreaterThan(0);
  });

  it("handles regex characters in the query without throwing", () => {
    expect(() =>
      scoreMatch(make({ body: "a (b) c" }), "(b)", now)
    ).not.toThrow();
  });
});
