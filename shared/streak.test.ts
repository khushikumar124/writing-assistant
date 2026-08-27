import { describe, expect, it } from "vitest";
import { toDayKeyInZone } from "./streak";

describe("toDayKeyInZone", () => {
  // 2026-08-05T20:30:00Z is still the 5th in London, already the 6th in Delhi,
  // and still the 5th in New York. This is exactly the case that made streaks
  // wrong when the server did the bucketing.
  const lateEvening = new Date("2026-08-05T20:30:00Z");

  it("uses the given zone, not the server's", () => {
    expect(toDayKeyInZone(lateEvening, "Asia/Kolkata")).toBe("2026-08-06");
    expect(toDayKeyInZone(lateEvening, "Europe/London")).toBe("2026-08-05");
    expect(toDayKeyInZone(lateEvening, "America/New_York")).toBe("2026-08-05");
  });

  it("handles a zone west of UTC rolling back a day", () => {
    const justAfterMidnightUtc = new Date("2026-08-06T02:00:00Z");
    expect(toDayKeyInZone(justAfterMidnightUtc, "America/Los_Angeles")).toBe(
      "2026-08-05"
    );
  });

  it("falls back to UTC for a nonsense zone rather than throwing", () => {
    expect(toDayKeyInZone(lateEvening, "Not/AZone")).toBe("2026-08-05");
  });

  it("formats as YYYY-MM-DD so keys sort lexicographically", () => {
    expect(toDayKeyInZone(new Date("2026-01-09T12:00:00Z"), "UTC")).toBe(
      "2026-01-09"
    );
  });
});
