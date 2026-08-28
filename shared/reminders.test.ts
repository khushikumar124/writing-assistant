import { describe, expect, it } from "vitest";
import { isReminderDue, reminderMessage, zonedParts } from "./reminders";

const base = {
  time: "09:00",
  days: [] as number[],
  timeZone: "Asia/Kolkata",
  lastRemindedAt: null as Date | null,
};

/** 09:15 in Kolkata on Wednesday 5 August 2026 is 03:45 UTC. */
const wedMorningIST = new Date("2026-08-05T03:45:00Z");

describe("zonedParts", () => {
  it("reads wall-clock time in the given zone", () => {
    const parts = zonedParts(wedMorningIST, "Asia/Kolkata");
    expect(parts.hour).toBe(9);
    expect(parts.minute).toBe(15);
    expect(parts.dayKey).toBe("2026-08-05");
    expect(parts.weekday).toBe(3); // Wednesday
  });

  it("gives a different day for the same instant in another zone", () => {
    // 2026-08-05T20:30Z is already the 6th in Kolkata.
    const late = new Date("2026-08-05T20:30:00Z");
    expect(zonedParts(late, "Asia/Kolkata").dayKey).toBe("2026-08-06");
    expect(zonedParts(late, "America/New_York").dayKey).toBe("2026-08-05");
  });

  it("falls back to UTC for a nonsense zone", () => {
    expect(zonedParts(wedMorningIST, "Not/AZone").hour).toBe(3);
  });
});

describe("isReminderDue", () => {
  it("fires daily once the chosen time has passed", () => {
    expect(isReminderDue({ ...base, frequency: "daily" }, wedMorningIST)).toBe(
      true
    );
  });

  it("does not fire before the chosen time", () => {
    const early = new Date("2026-08-05T02:00:00Z"); // 07:30 IST
    expect(isReminderDue({ ...base, frequency: "daily" }, early)).toBe(false);
  });

  it("does not fire long after the window, so a nudge is never stale", () => {
    const late = new Date("2026-08-05T09:00:00Z"); // 14:30 IST
    expect(isReminderDue({ ...base, frequency: "daily" }, late)).toBe(false);
  });

  it("never sends twice in the same local day", () => {
    const alreadySent = {
      ...base,
      frequency: "daily" as const,
      lastRemindedAt: new Date("2026-08-05T03:35:00Z"),
    };
    expect(isReminderDue(alreadySent, wedMorningIST)).toBe(false);
  });

  it("sends again the next day", () => {
    const yesterday = {
      ...base,
      frequency: "daily" as const,
      lastRemindedAt: new Date("2026-08-04T03:35:00Z"),
    };
    expect(isReminderDue(yesterday, wedMorningIST)).toBe(true);
  });

  it("weekly only fires on the chosen weekday", () => {
    expect(
      isReminderDue({ ...base, frequency: "weekly", days: [3] }, wedMorningIST)
    ).toBe(true);
    expect(
      isReminderDue({ ...base, frequency: "weekly", days: [1] }, wedMorningIST)
    ).toBe(false);
  });

  it("custom fires on any listed weekday", () => {
    expect(
      isReminderDue(
        { ...base, frequency: "custom", days: [1, 3, 5] },
        wedMorningIST
      )
    ).toBe(true);
    expect(
      isReminderDue(
        { ...base, frequency: "custom", days: [0, 6] },
        wedMorningIST
      )
    ).toBe(false);
  });

  it("monthly fires on the chosen day of the month", () => {
    expect(
      isReminderDue({ ...base, frequency: "monthly", days: [5] }, wedMorningIST)
    ).toBe(true);
    expect(
      isReminderDue(
        { ...base, frequency: "monthly", days: [12] },
        wedMorningIST
      )
    ).toBe(false);
  });

  it("off never fires", () => {
    expect(isReminderDue({ ...base, frequency: "off" }, wedMorningIST)).toBe(
      false
    );
  });

  it("respects the user's zone rather than the server's", () => {
    // Same instant, but 09:15 IST is 23:45 the previous day in New York.
    const newYork = {
      ...base,
      frequency: "daily" as const,
      timeZone: "America/New_York",
    };
    expect(isReminderDue(newYork, wedMorningIST)).toBe(false);
  });
});

describe("reminderMessage", () => {
  it("mentions the pile when there is one worth mentioning", () => {
    expect(reminderMessage(4).body).toContain("4 loose thoughts");
  });

  it("never scolds, and never mentions a broken streak", () => {
    const message = `${reminderMessage(0).title} ${reminderMessage(0).body}`;
    expect(message.toLowerCase()).not.toMatch(/streak|missed|failed|behind/);
  });
});
