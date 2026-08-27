/**
 * Streak maths, kept pure and free of I/O so it can be tested directly.
 * Days are `YYYY-MM-DD` strings in the user's local timezone.
 */

export function toDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDays(dayKey: string, delta: number): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + delta);
  return toDayKey(date);
}

export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const start = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  return Math.round((end - start) / 86_400_000);
}

/**
 * Counts consecutive writing days ending today or yesterday. Yesterday still
 * counts so the streak doesn't appear broken before you've written today —
 * it only lapses once a full day has been missed.
 */
export function calculateStreak(writingDays: string[], today: string): number {
  if (writingDays.length === 0) return 0;

  const days = new Set(writingDays);

  let cursor: string;
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

/** Whole days since the most recent writing day, or null if never. */
export function daysSinceLastWrote(
  writingDays: string[],
  today: string
): number | null {
  if (writingDays.length === 0) return null;
  const mostRecent = writingDays.reduce((a, b) => (a > b ? a : b));
  return Math.max(0, daysBetween(mostRecent, today));
}

/** Short, non-saccharine nudge based on how long it's been. */
export function habitMessage(daysSince: number | null, streak: number): string {
  if (daysSince === null)
    return "Nothing written yet. The first line is the hard one.";
  if (streak >= 7) return `${streak} days running. This is a habit now.`;
  if (daysSince === 0)
    return streak > 1 ? `Day ${streak}. Keep it going.` : "Wrote today. Good.";
  if (daysSince === 1) return "Wrote yesterday. Pick it back up.";
  if (daysSince <= 6) return `${daysSince} days since you last wrote.`;
  if (daysSince <= 30)
    return `It's been ${daysSince} days. Start small — one paragraph.`;
  return "It's been a while. Open a draft and write one bad sentence.";
}
