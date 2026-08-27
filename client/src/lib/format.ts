/** Average adult reading speed, used for the "N min read" hint. */
const WORDS_PER_MINUTE = 200;

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

export function readingTimeMinutes(words: number): number {
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE));
}

/** "just now" / "3 hours ago" / "12 Mar" — short and glanceable. */
export function relativeTime(value: Date | string | null | undefined): string {
  if (!value) return "never";

  const date = value instanceof Date ? value : new Date(value);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(tag => typeof tag === "string")
      : [];
  } catch {
    return [];
  }
}

/**
 * Status reads as a journey rather than a database enum — a piece is a seed
 * that becomes a sketch that eventually ships.
 */
const STATUS_LABELS: Record<string, string> = {
  draft: "Seed",
  outline: "Sketch",
  "in-progress": "Cooking",
  completed: "Ready",
  published: "Shipped",
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * Status reads as a rubber stamp pressed onto the page — `.stamp` supplies the
 * double outline, the letterspacing and the slight tilt, and this just picks
 * the ink colour.
 */
export function statusClasses(status: string): string {
  switch (status) {
    case "published":
      return "stamp bg-sage/10 text-sage";
    case "completed":
      return "stamp bg-olive/10 text-olive";
    case "in-progress":
      return "stamp bg-clay/10 text-clay";
    case "outline":
      return "stamp bg-rose/10 text-rose";
    default:
      return "stamp bg-ochre/12 text-ochre";
  }
}
