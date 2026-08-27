import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime, statusClasses, statusLabel } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Combine,
  Compass,
  ExternalLink,
  Flame,
  Send,
} from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data, isPending } = trpc.stats.dashboard.useQuery();

  return (
    <AppShell>
      {isPending || !data ? (
        <DashboardSkeleton />
      ) : (
        <div className="space-y-8">
          {/* Habit layer: the thing that actually gets people writing again. */}
          <section className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl">
                {data.daysSinceLastWrote === 0
                  ? "You wrote today."
                  : data.daysSinceLastWrote === null
                    ? "Let's begin."
                    : `${data.daysSinceLastWrote} day${data.daysSinceLastWrote === 1 ? "" : "s"} since you last wrote.`}
              </h1>
              <p className="mt-2 text-muted-foreground">{data.message}</p>
            </div>

            {data.streak > 0 && (
              <div className="sticker plate flex items-center gap-2 bg-ochre/15 px-3 py-1.5">
                {/* The flame flickers only while the streak is alive — the one
                    piece of idle motion on the page, and it has earned it. */}
                <Flame
                  className="size-4 text-accent animate-flicker"
                  aria-hidden
                />
                <span className="typewriter">
                  {data.streak}-day streak
                </span>
              </div>
            )}
          </section>

          {/* Deliberately uneven: words written is the number that matters, so
              it takes a double-width panel with a ghost numeral behind it,
              and the rest sit around it. Four identical tiles is the layout
              that makes every dashboard look like every other dashboard. */}
          <section className="animate-in-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Words written is the headline figure, so it gets a tall
                double-width panel and the others tuck around it. */}
            <Stat
              label="Words written"
              value={data.totals.words.toLocaleString()}
              tint="ochre"
              className="sm:col-span-2 lg:row-span-2"
              big
            />
            <Stat label="Thoughts caught" value={data.totals.thoughts} tint="olive" />
            <Stat label="Ideas" value={data.totals.ideas} tint="rose" />
            <Stat
              label="Shipped"
              value={data.totals.published}
              tint="sage"
              className="sm:col-span-2"
            />
          </section>

          <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <Card className="p-6">
              <h2 className="mb-4 text-xl">Pick up where you left off</h2>

              {data.recentIdeas.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="mb-4 text-muted-foreground">
                    Nothing here yet. Capture a thought or start an idea.
                  </p>
                  <Button asChild variant="outline">
                    <Link href="/ideas">Create your first idea</Link>
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {data.recentIdeas.map(idea => (
                    <li key={idea.id}>
                      <Link
                        href={`/ideas/${idea.id}`}
                        className="group flex items-center gap-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium group-hover:text-primary">
                            {idea.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {idea.category} · edited{" "}
                            {relativeTime(idea.updatedAt)}
                            {idea.wordCount > 0 && ` · ${idea.wordCount} words`}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0",
                            statusClasses(idea.status)
                          )}
                        >
                          {statusLabel(idea.status)}
                        </span>
                        <ArrowRight
                          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <div className="space-y-4">
              {/* The forge is the app's distinctive move, so it gets top billing
                  whenever there is actually a pile to work with. */}
              {data.totals.unlinkedThoughts > 1 && (
                <QuickAction
                  href="/thoughts"
                  icon={Combine}
                  title="Build something from the pile"
                  body={`${data.totals.unlinkedThoughts} loose thoughts. Pick the ones that belong together.`}
                  tint="clay"
                  highlight
                />
              )}

              <QuickAction
                href="/discover"
                icon={Compass}
                title="Find something to write"
                body="Human-written prompts, filtered by mood or shape."
                tint="ochre"
              />

              <QuickAction
                href="/shipped"
                icon={Send}
                title="What you've shipped"
                tint="sage"
                body={
                  data.totals.published === 0
                    ? "Nothing on the shelf yet."
                    : `${data.totals.published} published · ${data.totals.wordsPublishedThisYear.toLocaleString()} words out this year.`
                }
              />
            </div>
          </section>

          {data.recentlyShipped.length > 0 && (
            <section>
              <h2 className="mb-4 text-xl">Recently shipped</h2>
              <ul className="grid gap-3 md:grid-cols-3">
                {data.recentlyShipped.map(idea => (
                  <li key={idea.id}>
                    <Card className="flex h-full flex-col justify-between gap-3 p-5">
                      <p className="font-medium leading-snug">{idea.title}</p>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          {idea.publishedAt?.toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                          })}
                          {idea.publishedIn && ` · ${idea.publishedIn}`}
                        </span>
                        {idea.publishedUrl && (
                          <a
                            href={idea.publishedUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-primary hover:underline"
                            aria-label={`Read ${idea.title}`}
                          >
                            <ExternalLink className="size-3.5" aria-hidden />
                          </a>
                        )}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </AppShell>
  );
}

/** Each counter gets its own hue, so the row reads as a set of tokens rather
 *  than four identical boxes. */
const STAT_TINTS = {
  olive: "bg-olive/12 border-olive/40 text-olive",
  rose: "bg-rose/10 border-rose/35 text-rose",
  ochre: "bg-ochre/15 border-ochre/45 text-ochre",
  sage: "bg-sage/12 border-sage/40 text-sage",
} as const;

function Stat({
  label,
  value,
  tint,
  className,
  big,
}: {
  label: string;
  value: string | number;
  tint: keyof typeof STAT_TINTS;
  className?: string;
  big?: boolean;
}) {
  /* A score panel rather than a card: squared corners, corner ticks, and the
     number set in typewriter figures over an oversized ghost of itself. */
  return (
    <Card
      className={cn(
        "panel relative justify-center gap-0 overflow-hidden px-5 py-4",
        STAT_TINTS[tint],
        className
      )}
    >
      <p className="typewriter text-muted-foreground">{label}</p>
      <p className={cn("typewriter-num mt-1", big ? "text-6xl" : "text-3xl")}>
        {value}
      </p>
      {big && <span className="ghost-figure">{value}</span>}
    </Card>
  );
}

/** Icon chip colours, so the three shortcuts don't stack up identically. */
const ACTION_TINTS = {
  clay: "border-clay/40 bg-clay/15 text-clay",
  ochre: "border-ochre/45 bg-ochre/15 text-ochre",
  sage: "border-sage/40 bg-sage/12 text-sage",
} as const;

function QuickAction({
  href,
  icon: Icon,
  title,
  body,
  tint,
  highlight,
}: {
  href: string;
  icon: typeof Compass;
  title: string;
  body: string;
  tint: keyof typeof ACTION_TINTS;
  highlight?: boolean;
}) {
  return (
    <Link href={href}>
      <Card
        className={cn(
          "card-lift group flex items-start gap-4 p-5",
          highlight && "border-clay/40 bg-clay/8"
        )}
      >
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg border",
            ACTION_TINTS[tint]
          )}
        >
          <Icon className="size-4 transition-transform group-hover:scale-110" aria-hidden />
        </span>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
        </div>
      </Card>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-12 w-2/3" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
