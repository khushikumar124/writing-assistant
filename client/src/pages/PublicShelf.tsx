import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { trpc } from "@/lib/trpc";
import { ExternalLink, Feather } from "lucide-react";
import { Link, useParams } from "wouter";

/**
 * Someone's public shelf at `/@handle`.
 *
 * Anonymous and read-only: it shows titles, blurbs, and links to work that is
 * already published elsewhere. Draft prose, thoughts, and streaks never appear
 * here — a shelf is a bibliography, not an open notebook.
 */
export default function PublicShelf() {
  const params = useParams<{ username: string }>();
  const username = params.username ?? "";

  const { data, isPending, isError } = trpc.profile.publicShelf.useQuery(
    { username },
    { retry: false, enabled: username.length > 0 }
  );

  if (isPending) {
    return (
      <Frame>
        <Skeleton className="h-10 w-64" />
        <div className="mt-8 space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24" />
          ))}
        </div>
      </Frame>
    );
  }

  if (isError || !data) {
    return (
      <Frame>
        <div className="py-20 text-center">
          <h1 className="mb-2 text-2xl">No shelf here</h1>
          <p className="mb-6 text-muted-foreground">
            This handle doesn't exist, or its owner hasn't made their shelf
            public.
          </p>
          <Button asChild variant="outline">
            <Link href="/">Go to Nook</Link>
          </Button>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <header className="border-b border-border pb-8">
        <h1 className="text-4xl md:text-5xl">{data.name ?? data.username}</h1>
        <p className="mt-2 text-muted-foreground">@{data.username}</p>
        {data.bio && (
          <p className="mt-4 max-w-2xl text-lg leading-relaxed">{data.bio}</p>
        )}

        <p className="mt-6 text-sm text-muted-foreground">
          {data.pieces.length} piece{data.pieces.length === 1 ? "" : "s"}{" "}
          published
          {data.totalWords > 0 &&
            ` · ${data.totalWords.toLocaleString()} words`}
        </p>
      </header>

      {data.pieces.length === 0 ? (
        <p className="py-16 text-center text-muted-foreground">
          Nothing published yet.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {data.pieces.map(piece => (
            <li key={piece.id} className="py-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-medium">{piece.title}</h2>
                  {piece.description && (
                    <p className="mt-1 leading-relaxed text-muted-foreground">
                      {piece.description}
                    </p>
                  )}
                  <p className="mt-2 text-sm text-muted-foreground">
                    {piece.publishedAt?.toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {piece.publishedIn && ` · ${piece.publishedIn}`}
                  </p>
                </div>

                {piece.url && (
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={piece.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <ExternalLink className="mr-2 size-3.5" aria-hidden />
                      Read
                    </a>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl py-16">
        {children}

        <footer className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
          <Link
            href="/"
            className="flex items-center gap-2 hover:text-foreground"
          >
            <Feather className="size-4" aria-hidden />
            Kept with Nook
          </Link>
        </footer>
      </div>
    </div>
  );
}
