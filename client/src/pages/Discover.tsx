import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  PROMPT_KIND_BLURBS,
  PROMPT_KIND_LABELS,
  PROMPT_KINDS,
} from "@shared/prompts";
import { Check, Copy, Plus, Shuffle, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type Filter = "all" | (typeof PROMPT_KINDS)[number] | "mine";

/** One hue per category, so the library scans as a colourful set. */
const KIND_TINTS: Record<string, string> = {
  reflection: "border-rose/40 bg-rose/10 text-rose",
  technical: "border-sage/40 bg-sage/10 text-sage",
  short: "border-ochre/50 bg-ochre/12 text-ochre",
  creative: "border-clay/45 bg-clay/10 text-clay",
  analysis: "border-olive/45 bg-olive/12 text-olive",
  constraint: "border-coral/45 bg-coral/10 text-coral",
};

/**
 * Discover, as one page.
 *
 * This replaced four separate modes (topics, moods, slump-buster, analogies)
 * that were really one thing wearing four hats: a list of prompts you filter.
 * Collapsing them makes the library a single dataset users can add to, instead
 * of four hardcoded arrays nobody could extend.
 */
export default function Discover() {
  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState("");
  const [shuffled, setShuffled] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data, isPending } = trpc.prompts.list.useQuery();

  const create = trpc.prompts.create.useMutation({
    onSuccess: async () => {
      setDraftPrompt("");
      setAdding(false);
      await utils.prompts.list.invalidate();
      toast.success("Added to your library.");
    },
    onError: error => toast.error(error.message),
  });

  const remove = trpc.prompts.delete.useMutation({
    onSuccess: async () => {
      await utils.prompts.list.invalidate();
      toast.success("Removed.");
    },
    onError: error => toast.error(error.message),
  });

  const visible = useMemo(() => {
    const all = data?.prompts ?? [];
    if (filter === "all") return all;
    if (filter === "mine") return all.filter(prompt => prompt.own);
    return all.filter(prompt => prompt.kind === filter);
  }, [data, filter]);

  const shuffle = () => {
    if (visible.length === 0) return;
    setShuffled(visible[Math.floor(Math.random() * visible.length)].id);
  };

  const shuffledPrompt = visible.find(prompt => prompt.id === shuffled) ?? null;

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl">What's on your mind today?</h1>
            <p className="mt-1 max-w-xl text-muted-foreground">
              Every prompt here was written by a person. Nothing on this page is
              generated, and nothing is personalised by watching you.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={shuffle}
            disabled={visible.length === 0}
          >
            <Shuffle className="mr-2 size-4" aria-hidden />
            Shuffle
          </Button>
        </div>

        {isPending ? (
          <Skeleton className="h-32" />
        ) : (
          <>
            {/* The day's prompt: same all day, on every device. */}
            {data?.today && (
              /* A ticket stub — the one prompt you're handed today, torn off
                 the roll. */
              <Card className="ticket border-ochre/45 bg-ochre/10 p-6">
                <p className="typewriter text-ochre">Today's ticket · one only</p>
                <p className="mt-3 font-serif text-2xl leading-snug">
                  {data.today.text}
                </p>
                <PromptActions text={data.today.text} className="mt-5" />
              </Card>
            )}

            {shuffledPrompt && (
              <Card className="ticket border-rose/40 bg-rose/8 p-6">
                <p className="typewriter text-rose">Shuffled</p>
                <p className="mt-3 font-serif text-2xl leading-snug">
                  {shuffledPrompt.text}
                </p>
                <PromptActions text={shuffledPrompt.text} className="mt-5" />
              </Card>
            )}

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <FilterChip
                  active={filter === "all"}
                  onClick={() => setFilter("all")}
                >
                  Everything
                </FilterChip>
                {PROMPT_KINDS.map(kind => (
                  <FilterChip
                    key={kind}
                    active={filter === kind}
                    onClick={() => setFilter(kind)}
                    title={PROMPT_KIND_BLURBS[kind]}
                  >
                    {PROMPT_KIND_LABELS[kind]}
                  </FilterChip>
                ))}
                <FilterChip
                  active={filter === "mine"}
                  onClick={() => setFilter("mine")}
                >
                  Mine
                </FilterChip>
              </div>

              {filter !== "all" && filter !== "mine" && (
                <p className="text-sm text-muted-foreground">
                  {PROMPT_KIND_BLURBS[filter]}
                </p>
              )}
            </div>

            <div className="space-y-4">
              {adding ? (
                <Card className="p-4">
                  <div className="flex flex-wrap gap-2">
                    <Input
                      autoFocus
                      value={draftPrompt}
                      onChange={event => setDraftPrompt(event.target.value)}
                      onKeyDown={event => {
                        if (event.key === "Enter" && draftPrompt.trim()) {
                          create.mutate({
                            text: draftPrompt.trim(),
                            kind: "general",
                          });
                        }
                        if (event.key === "Escape") setAdding(false);
                      }}
                      placeholder="A prompt you want to come back to…"
                      className="min-w-60 flex-1"
                    />
                    <Button
                      onClick={() =>
                        create.mutate({
                          text: draftPrompt.trim(),
                          kind: "general",
                        })
                      }
                      disabled={!draftPrompt.trim() || create.isPending}
                    >
                      Add
                    </Button>
                    <Button variant="ghost" onClick={() => setAdding(false)}>
                      Cancel
                    </Button>
                  </div>
                </Card>
              ) : (
                <Button variant="outline" onClick={() => setAdding(true)}>
                  <Plus className="mr-2 size-4" aria-hidden />
                  Add your own prompt
                </Button>
              )}

              {visible.length === 0 ? (
                <Card className="p-10 text-center text-muted-foreground">
                  {filter === "mine"
                    ? "You haven't added any prompts yet."
                    : "Nothing in this category."}
                </Card>
              ) : (
                /* Flowing columns rather than a fixed grid, so prompts of very
                   different lengths don't leave big holes in the page. */
                <ul className="board">
                  {visible.map((prompt, index) => (
                    <li key={prompt.id}>
                      <Card
                        className={cn(
                          "flex h-full flex-col justify-between gap-4 p-5",
                          // Every fourth one is a torn-off slip, for texture.
                          index % 4 === 3 && "torn-bottom pb-7"
                        )}
                      >
                        <p className="font-serif text-lg leading-snug">
                          {prompt.text}
                        </p>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              "typewriter plate border px-1.5 py-0.5",
                              prompt.own
                                ? "border-rose/40 bg-rose/10 text-rose"
                                : KIND_TINTS[
                                    prompt.kind as keyof typeof KIND_TINTS
                                  ] || "border-line bg-muted text-muted-foreground"
                            )}
                          >
                            {prompt.own
                              ? "Yours"
                              : (PROMPT_KIND_LABELS[
                                  prompt.kind as keyof typeof PROMPT_KIND_LABELS
                                ] ?? prompt.kind)}
                          </span>
                          <div className="flex items-center gap-1">
                            <PromptActions text={prompt.text} compact />
                            {prompt.own && prompt.dbId !== null && (
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label="Delete prompt"
                                onClick={() =>
                                  remove.mutate({ id: prompt.dbId as number })
                                }
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function FilterChip({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

/** Copy the prompt, or turn it straight into an idea and start writing. */
function PromptActions({
  text,
  compact,
  className,
}: {
  text: string;
  compact?: boolean;
  className?: string;
}) {
  const [, navigate] = useLocation();
  const [copied, setCopied] = useState(false);
  const utils = trpc.useUtils();
  const { data: categories = [] } = trpc.categories.list.useQuery();

  const createIdea = trpc.ideas.create.useMutation({
    onSuccess: async idea => {
      await Promise.all([
        utils.ideas.list.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);
      navigate(`/ideas/${idea.id}`);
    },
    onError: error => toast.error(error.message),
  });

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button size="sm" variant="ghost" onClick={copy} aria-label="Copy prompt">
        {copied ? (
          <Check className="size-3.5 text-primary" aria-hidden />
        ) : (
          <Copy className="size-3.5" aria-hidden />
        )}
        {!compact && <span className="ml-2">{copied ? "Copied" : "Copy"}</span>}
      </Button>

      <Button
        size="sm"
        variant={compact ? "ghost" : "default"}
        disabled={createIdea.isPending}
        onClick={() =>
          createIdea.mutate({
            title: text.length > 90 ? `${text.slice(0, 87)}…` : text,
            category: categories[0]?.name ?? "Uncategorised",
          })
        }
      >
        {compact ? "Write" : "Start writing this"}
      </Button>
    </div>
  );
}
