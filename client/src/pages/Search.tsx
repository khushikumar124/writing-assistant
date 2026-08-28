import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounced } from "@/hooks/useDebounced";
import { relativeTime, statusClasses, statusLabel } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { IDEA_STATUSES } from "@shared/types";
import { FileText, Feather, Lightbulb, X } from "lucide-react";
import { useState } from "react";
import { Link, useSearch } from "wouter";

const ICONS = { idea: Lightbulb, thought: Feather, draft: FileText } as const;
const LABELS = { idea: "Idea", thought: "Thought", draft: "Draft" } as const;

type Kind = keyof typeof ICONS;

const AGES: { label: string; days?: number }[] = [
  { label: "Any time" },
  { label: "Past week", days: 7 },
  { label: "Past month", days: 30 },
  { label: "Past year", days: 365 },
];

export default function Search() {
  const search = useSearch();
  const initial = new URLSearchParams(search).get("q") ?? "";

  const [term, setTerm] = useState(initial);
  const [kinds, setKinds] = useState<Kind[]>([]);
  const [status, setStatus] = useState<string | undefined>();
  const [category, setCategory] = useState<string | undefined>();
  const [withinDays, setWithinDays] = useState<number | undefined>();

  // Debounced so typing doesn't fire a query per keystroke.
  const debounced = useDebounced(term, 250);

  const { data: facets } = trpc.search.facets.useQuery();
  const { data: hits, isFetching } = trpc.search.query.useQuery(
    {
      term: debounced,
      kinds: kinds.length > 0 ? kinds : undefined,
      status: status as (typeof IDEA_STATUSES)[number] | undefined,
      category,
      withinDays,
    },
    { enabled: debounced.trim().length >= 2 }
  );

  const toggleKind = (kind: Kind) =>
    setKinds(current =>
      current.includes(kind)
        ? current.filter(value => value !== kind)
        : [...current, kind]
    );

  const filtersActive =
    kinds.length > 0 || status || category || withinDays !== undefined;

  const clearFilters = () => {
    setKinds([]);
    setStatus(undefined);
    setCategory(undefined);
    setWithinDays(undefined);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl">Search</h1>
          <p className="mt-1 text-muted-foreground">
            Across your thoughts, ideas, and everything you've drafted — best
            matches first, not just the newest.
          </p>
        </div>

        <Input
          autoFocus
          value={term}
          onChange={event => setTerm(event.target.value)}
          placeholder="What are you looking for?"
          className="h-12 text-lg"
          aria-label="Search your writing"
        />

        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(ICONS) as Kind[]).map(kind => (
              <Chip
                key={kind}
                active={kinds.includes(kind)}
                onClick={() => toggleKind(kind)}
              >
                {LABELS[kind]}s
              </Chip>
            ))}

            <span className="mx-1 h-4 w-px bg-border" />

            {AGES.map(age => (
              <Chip
                key={age.label}
                active={withinDays === age.days}
                onClick={() => setWithinDays(age.days)}
              >
                {age.label}
              </Chip>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {IDEA_STATUSES.map(value => (
              <Chip
                key={value}
                active={status === value}
                onClick={() => setStatus(status === value ? undefined : value)}
              >
                {statusLabel(value)}
              </Chip>
            ))}

            {(facets?.categories ?? []).map(name => (
              <Chip
                key={name}
                active={category === name}
                onClick={() =>
                  setCategory(category === name ? undefined : name)
                }
              >
                {name}
              </Chip>
            ))}

            {filtersActive && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                <X className="mr-1 size-3.5" aria-hidden />
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {debounced.trim().length < 2 ? (
          <p className="py-12 text-center text-muted-foreground">
            Type at least two characters.
          </p>
        ) : isFetching && !hits ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-20" />
            ))}
          </div>
        ) : hits && hits.length > 0 ? (
          <>
            <p className="typewriter text-muted-foreground">
              {hits.length} result{hits.length === 1 ? "" : "s"}
            </p>
            <ul className="space-y-3">
              {hits.map(hit => {
                const Icon = ICONS[hit.kind];
                const href = hit.ideaId ? `/ideas/${hit.ideaId}` : "/thoughts";

                return (
                  <li key={`${hit.kind}-${hit.id}`}>
                    <Link href={href}>
                      <Card className="card-lift p-4">
                        <div className="flex items-start gap-3">
                          <Icon
                            className="mt-1 size-4 shrink-0 text-primary"
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{hit.title}</p>
                              <span className="typewriter text-muted-foreground">
                                {LABELS[hit.kind]}
                              </span>
                              {hit.status && (
                                <span className={cn(statusClasses(hit.status))}>
                                  {statusLabel(hit.status)}
                                </span>
                              )}
                            </div>
                            {hit.excerpt && (
                              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                                {hit.excerpt}
                              </p>
                            )}
                            <p className="typewriter mt-1 text-muted-foreground">
                              {hit.category ? `${hit.category} · ` : ""}
                              {relativeTime(hit.updatedAt)}
                            </p>
                          </div>
                        </div>
                      </Card>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="py-12 text-center text-muted-foreground">
            Nothing matches “{debounced}”
            {filtersActive ? " with these filters" : ""}.
          </p>
        )}
      </div>
    </AppShell>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "typewriter plate border px-2 py-1 transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-line bg-muted text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
