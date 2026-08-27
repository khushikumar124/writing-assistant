import AppShell from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { useDebounced } from "@/hooks/useDebounced";
import { FileText, Feather, Lightbulb } from "lucide-react";
import { useState } from "react";
import { Link, useSearch } from "wouter";

const ICONS = {
  idea: Lightbulb,
  thought: Feather,
  draft: FileText,
} as const;

const LABELS = {
  idea: "Idea",
  thought: "Thought",
  draft: "Draft",
} as const;

export default function Search() {
  const search = useSearch();
  const initial = new URLSearchParams(search).get("q") ?? "";

  const [term, setTerm] = useState(initial);
  // Debounced so typing doesn't fire a query per keystroke.
  const debounced = useDebounced(term, 250);

  const { data: hits, isFetching } = trpc.search.query.useQuery(
    { term: debounced },
    { enabled: debounced.trim().length >= 2 }
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl">Search</h1>
          <p className="mt-1 text-muted-foreground">
            Across your thoughts, ideas, and everything you've drafted.
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
                          <div className="flex flex-wrap items-baseline gap-2">
                            <p className="font-medium">{hit.title}</p>
                            <span className="text-xs uppercase tracking-wider text-muted-foreground">
                              {LABELS[hit.kind]}
                            </span>
                          </div>
                          {hit.excerpt && (
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {hit.excerpt}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
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
        ) : (
          <p className="py-12 text-center text-muted-foreground">
            Nothing matches “{debounced}”.
          </p>
        )}
      </div>
    </AppShell>
  );
}
