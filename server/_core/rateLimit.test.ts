import { TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consume, resetAllLimits } from "./rateLimit";

const rule = { limit: 3, windowMs: 60_000 };

describe("consume", () => {
  beforeEach(() => {
    resetAllLimits();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit", () => {
    for (let attempt = 0; attempt < rule.limit; attempt++) {
      expect(() => consume("key", rule)).not.toThrow();
    }
  });

  it("rejects the request past the limit", () => {
    for (let attempt = 0; attempt < rule.limit; attempt++) consume("key", rule);
    expect(() => consume("key", rule)).toThrow(TRPCError);
  });

  it("tells the caller how long to wait", () => {
    for (let attempt = 0; attempt < rule.limit; attempt++) consume("key", rule);
    expect(() => consume("key", rule)).toThrow(/try again in \d+ minute/i);
  });

  it("keeps separate budgets per key, so one user can't lock out another", () => {
    for (let attempt = 0; attempt < rule.limit; attempt++)
      consume("alice", rule);
    expect(() => consume("bob", rule)).not.toThrow();
  });

  it("forgives once the window has passed", () => {
    for (let attempt = 0; attempt < rule.limit; attempt++) consume("key", rule);
    vi.advanceTimersByTime(rule.windowMs + 1);
    expect(() => consume("key", rule)).not.toThrow();
  });

  it("does not forgive early", () => {
    for (let attempt = 0; attempt < rule.limit; attempt++) consume("key", rule);
    vi.advanceTimersByTime(rule.windowMs - 1_000);
    expect(() => consume("key", rule)).toThrow(TRPCError);
  });
});
