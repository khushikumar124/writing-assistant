/**
 * Search relevance.
 *
 * Kept as a pure scoring function rather than pushed into SQL, for two reasons.
 * SQLite's FTS5 ranks by BM25 over term frequency, which is the wrong instinct
 * for a personal writing archive — a draft that says "index" forty times is not
 * more relevant than the idea actually titled "Indexes"; and doing it here
 * means the weighting is testable and legible instead of buried in a query.
 *
 * At the scale this operates on — one person's writing, hundreds of rows — the
 * cost of scoring in JS is invisible.
 */

export type SearchKind = "idea" | "thought" | "draft";

export type Scorable = {
  kind: SearchKind;
  title: string;
  body: string;
  updatedAt: Date;
};

/** Where a match landed, most significant first. */
const FIELD_WEIGHT = {
  /** A title match is the strongest signal there is. */
  titleExact: 100,
  titleStart: 60,
  titleWord: 45,
  titlePartial: 25,
  bodyWord: 12,
  bodyPartial: 5,
} as const;

/** What a hit is worth before recency and length are considered. */
function fieldScore(
  haystack: string,
  needle: string,
  inTitle: boolean
): number {
  if (!haystack) return 0;

  const text = haystack.toLowerCase();
  const term = needle.toLowerCase();
  const index = text.indexOf(term);
  if (index === -1) return 0;

  // Whole-word matches beat matches that happen to fall inside a longer word,
  // so searching "art" does not rank "starting" above "Art of the sentence".
  const wordBoundary = new RegExp(`\\b${escapeRegExp(term)}\\b`).test(text);

  if (inTitle) {
    if (text === term) return FIELD_WEIGHT.titleExact;
    if (index === 0) return FIELD_WEIGHT.titleStart;
    return wordBoundary ? FIELD_WEIGHT.titleWord : FIELD_WEIGHT.titlePartial;
  }

  return wordBoundary ? FIELD_WEIGHT.bodyWord : FIELD_WEIGHT.bodyPartial;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Recency as a gentle multiplier rather than a sort key.
 *
 * Something touched today is usually what you meant, but a strong title match
 * from last year should still beat a passing mention from this morning — so
 * this tops out at a 25% boost and decays over roughly two months.
 */
function recencyBoost(updatedAt: Date, now: Date): number {
  const days = (now.getTime() - updatedAt.getTime()) / 86_400_000;
  if (days <= 0) return 1.25;
  return 1 + 0.25 * Math.exp(-days / 60);
}

/**
 * Scores one item against a query. Multi-word queries score each word and add
 * a bonus when the whole phrase appears, so "database index" ranks a piece
 * containing that phrase above one that mentions both words separately.
 */
export function scoreMatch(
  item: Scorable,
  query: string,
  now = new Date()
): number {
  const trimmed = query.trim();
  if (!trimmed) return 0;

  const words = trimmed.split(/\s+/).filter(word => word.length > 1);
  const terms = words.length > 0 ? words : [trimmed];

  let score = 0;
  for (const term of terms) {
    score += fieldScore(item.title, term, true);
    score += fieldScore(item.body, term, false);
  }

  // Whole-phrase bonus, only when the query was actually multi-word.
  if (terms.length > 1) {
    score += fieldScore(item.title, trimmed, true) * 1.5;
    score += fieldScore(item.body, trimmed, false) * 1.5;
  }

  if (score === 0) return 0;

  // An idea is a deliberate object; a thought is a scrap. When everything else
  // is equal, the deliberate thing is more likely to be what was wanted.
  const kindWeight =
    item.kind === "idea" ? 1.15 : item.kind === "draft" ? 1.05 : 1;

  return score * kindWeight * recencyBoost(item.updatedAt, now);
}
