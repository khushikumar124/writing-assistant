import { describe, expect, it } from "vitest";
import { CURATED_PROMPTS, PROMPT_KINDS, promptOfTheDay } from "./prompts";

describe("the curated library", () => {
  it("gives every prompt a unique id", () => {
    const ids = CURATED_PROMPTS.map(prompt => prompt.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only uses known kinds", () => {
    for (const prompt of CURATED_PROMPTS) {
      expect(PROMPT_KINDS).toContain(prompt.kind);
    }
  });

  it("has prompts in every kind, so no filter is a dead end", () => {
    for (const kind of PROMPT_KINDS) {
      expect(CURATED_PROMPTS.some(prompt => prompt.kind === kind)).toBe(true);
    }
  });
});

describe("promptOfTheDay", () => {
  it("returns the same prompt all day", () => {
    const first = promptOfTheDay("2026-08-05");
    const second = promptOfTheDay("2026-08-05");
    expect(first).toEqual(second);
  });

  it("changes from one day to the next", () => {
    // Not guaranteed for every possible pair, but across a fortnight a library
    // this size should produce more than one distinct prompt.
    const week = Array.from(
      { length: 14 },
      (_, day) =>
        promptOfTheDay(`2026-08-${String(day + 1).padStart(2, "0")}`)?.id
    );
    expect(new Set(week).size).toBeGreaterThan(1);
  });

  it("always picks from the pool it was given", () => {
    const pool = CURATED_PROMPTS.slice(0, 3);
    const chosen = promptOfTheDay("2026-01-01", pool);
    expect(pool).toContainEqual(chosen);
  });

  it("returns null for an empty pool rather than throwing", () => {
    expect(promptOfTheDay("2026-01-01", [])).toBeNull();
  });
});
