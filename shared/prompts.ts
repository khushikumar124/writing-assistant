/**
 * The curated prompt library behind Discover.
 *
 * These are version-controlled rather than seeded into the database: they are
 * the same for every account, they change when we edit this file, and a fresh
 * install has a full library without running a seed script. Only prompts a
 * writer adds themselves live in the `prompts` table.
 *
 * Everything here is human-written. That is the whole point of the product, so
 * it is worth stating plainly: nothing in this file is generated.
 */

export const PROMPT_KINDS = [
  "reflection",
  "technical",
  "short",
  "creative",
  "analysis",
  "constraint",
] as const;
export type PromptKind = (typeof PROMPT_KINDS)[number];

export const PROMPT_KIND_LABELS: Record<PromptKind, string> = {
  reflection: "Reflection",
  technical: "Technical",
  short: "Short & quick",
  creative: "Creative",
  analysis: "Analysis",
  constraint: "Constraints",
};

export const PROMPT_KIND_BLURBS: Record<PromptKind, string> = {
  reflection: "Career turns, changed minds, things learned the hard way.",
  technical: "Systems, architecture, and what broke in production.",
  short: "Under 500 words. For a morning that only has twenty minutes in it.",
  creative: "Where craft, design, and engineering overlap.",
  analysis: "Take something apart and show the pieces.",
  constraint: "Not a subject — a rule. For when nothing comes.",
};

export type CuratedPrompt = {
  id: string;
  text: string;
  kind: PromptKind;
};

/** Stable ids (`kind-n`) so a favourite or a "seen today" never shifts. */
function build(kind: PromptKind, texts: string[]): CuratedPrompt[] {
  return texts.map((text, index) => ({
    id: `${kind}-${index + 1}`,
    text,
    kind,
  }));
}

export const CURATED_PROMPTS: CuratedPrompt[] = [
  ...build("technical", [
    "Explain a complex concept you recently learned, to someone one step behind you",
    "Break down a system architecture you find genuinely beautiful",
    "A production issue you debugged, and what it taught you about the system",
    "Compare two technologies you've used in anger — not from the docs",
    "The thing everyone gets wrong about your specialty",
    "Build a feature from scratch, narrating every decision you make",
    "A bug that took days and turned out to be one character",
    "The abstraction you regret introducing",
    "What your monitoring doesn't tell you",
    "A technical concept explained without a single piece of jargon",
  ]),
  ...build("reflection", [
    "A lesson you learned the hard way",
    "What you wish you'd known when you started",
    "A mistake that changed how you work",
    "The moment you realised you'd outgrown a role",
    "How your relationship with work has shifted",
    "Something you believed strongly and no longer do",
    "The advice you were given that turned out to be wrong",
    "A conversation that stuck with you, and why",
    "A letter to yourself three years ago",
    "The part of your job nobody warned you about",
  ]),
  ...build("creative", [
    "Where design and engineering disagree, and who is usually right",
    "A piece of art that changed how you think about your craft",
    "Apply a principle from one discipline to a problem in another",
    "The aesthetics of something nobody finds beautiful",
    "A creative project that failed interestingly",
    "What music and systems have in common",
    "The most elegant thing you saw this year, in any field",
    "Something ordinary, described as if you'd never seen it before",
  ]),
  ...build("short", [
    "One thing you learned today, in 100 words",
    "A hot take you can defend in 400 words",
    "Something you noticed this week",
    "A small thing that makes a disproportionate difference",
    "The industry convention that makes no sense to you",
    "Three unrelated things that turned out to be related",
    "What nobody talks about",
    "The most useful tool you found this year, and why",
  ]),
  ...build("analysis", [
    "A deep dive into a trend you're sceptical of",
    "What the data actually says, versus what everyone repeats",
    "A case study worth dissecting",
    "Trace one decision through to all its downstream consequences",
    "The strongest version of an argument you disagree with",
    "Something that worked, and an honest account of why",
  ]),
  ...build("constraint", [
    "Write 200 words without using the word 'I'",
    "Explain your last project in exactly three paragraphs",
    "Write the ending first, then work backwards",
    "One page, no adjectives",
    "Write it as a letter to a specific person",
    "Start with the most boring sentence you can, then earn the reader back",
    "Write the version you'd be embarrassed to publish, then keep the true parts",
    "Set a timer for fifteen minutes and don't stop typing",
    "Explain it to someone who is smart but has no context at all",
    "Write only the questions. Answer none of them.",
  ]),
];

/**
 * The day's prompt, chosen deterministically from the date so it is the same
 * all day and on every device — a random pick on each render is noise, not a
 * prompt you can sit with over a coffee.
 */
export function promptOfTheDay(
  dayKey: string,
  pool: CuratedPrompt[] = CURATED_PROMPTS
) {
  if (pool.length === 0) return null;

  let hash = 0;
  for (let index = 0; index < dayKey.length; index++) {
    hash = (hash * 31 + dayKey.charCodeAt(index)) | 0;
  }
  return pool[Math.abs(hash) % pool.length];
}
