import type { ReminderFrequency } from "./domain";

/**
 * Deciding whether a reminder is due.
 *
 * Kept pure and free of I/O so the awkward cases — timezones, month
 * boundaries, a server that restarts mid-window — can be tested directly
 * rather than by waiting around for a scheduler to fire.
 */

export type ReminderSettings = {
  frequency: ReminderFrequency;
  /** Local wall clock, "HH:MM". */
  time: string;
  /** Weekday numbers, 0 = Sunday. Used by "weekly" and "custom". */
  days: number[];
  timeZone: string;
  lastRemindedAt: Date | null;
};

/** The wall-clock parts of `at` in a given zone, without pulling in a library. */
export function zonedParts(at: Date, timeZone: string) {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    }).formatToParts(at);
  } catch {
    // An unknown zone should not stop reminders entirely; UTC is a safe floor.
    return zonedParts(at, "UTC");
  }

  const find = (type: string) =>
    parts.find(part => part.type === type)?.value ?? "";

  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  // `hour` can come back as "24" at midnight in some environments.
  const hour = Number(find("hour")) % 24;

  return {
    year: Number(find("year")),
    month: Number(find("month")),
    day: Number(find("day")),
    hour,
    minute: Number(find("minute")),
    weekday: weekdays[find("weekday")] ?? 0,
    dayKey: `${find("year")}-${find("month")}-${find("day")}`,
  };
}

/** Whether this weekday/date is one the user asked to hear from us on. */
function matchesSchedule(
  frequency: ReminderFrequency,
  days: number[],
  parts: ReturnType<typeof zonedParts>
): boolean {
  switch (frequency) {
    case "daily":
      return true;
    case "weekly":
      // Defaults to Monday if they never picked a day, which is the least
      // surprising choice for a "start of the week" nudge.
      return parts.weekday === (days[0] ?? 1);
    case "monthly":
      return parts.day === (days[0] ?? 1);
    case "custom":
      return days.includes(parts.weekday);
    case "off":
      return false;
  }
}

/**
 * True when a reminder should go out right now.
 *
 * The window is "at or after the chosen time, on a matching day, and not
 * already sent today". Being late is fine — a machine that was asleep at 09:00
 * should still nudge at 09:20 rather than skipping the day — but it never fires
 * twice for the same day, which is what `lastRemindedAt` guards.
 */
export function isReminderDue(
  settings: ReminderSettings,
  now: Date,
  /** How late is still worth sending, in minutes. */
  graceMinutes = 120
): boolean {
  if (settings.frequency === "off") return false;

  const parts = zonedParts(now, settings.timeZone);
  if (!matchesSchedule(settings.frequency, settings.days, parts)) return false;

  const [hourText, minuteText] = settings.time.split(":");
  const targetMinutes = Number(hourText) * 60 + Number(minuteText);
  const nowMinutes = parts.hour * 60 + parts.minute;

  const elapsed = nowMinutes - targetMinutes;
  if (elapsed < 0 || elapsed > graceMinutes) return false;

  // Already sent today, in the user's own day, so a restart can't double up.
  if (settings.lastRemindedAt) {
    const last = zonedParts(settings.lastRemindedAt, settings.timeZone);
    if (last.dayKey === parts.dayKey) return false;
  }

  return true;
}

/**
 * What the notification says.
 *
 * Written to invite rather than nag. Nothing here mentions a broken streak or
 * how long it has been — a reminder that opens with an accusation is one people
 * turn off, and the whole point is to be welcome.
 */
export function reminderMessage(unsortedThoughts: number): {
  title: string;
  body: string;
} {
  if (unsortedThoughts >= 3) {
    return {
      title: "There's a pile waiting",
      body: `${unsortedThoughts} loose thoughts. Some of them probably belong together.`,
    };
  }

  return {
    title: "Time to write, if you'd like",
    body: "A few minutes is enough. It doesn't have to be good.",
  };
}
