import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadShareCard } from "@/lib/shareCard";
import { trpc } from "@/lib/trpc";
import { ExternalLink, Globe, ImageDown, Rss, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

/**
 * The shelf: everything that actually went out.
 *
 * Drafts and streaks measure effort; this measures results. It's the page a
 * writer opens on a bad day, and the one thing here worth showing anyone else.
 */
export default function Shipped() {
  const { data: pieces, isPending } = trpc.ideas.listPublished.useQuery();
  const { data: profile } = trpc.profile.mine.useQuery();

  const totalWords = (pieces ?? []).reduce(
    (sum, idea) => sum + idea.wordCount,
    0
  );
  const thisYear = new Date().getFullYear();
  const thisYearPieces = (pieces ?? []).filter(
    idea => idea.publishedAt?.getFullYear() === thisYear
  );

  const shareUrl = profile?.username
    ? `${window.location.origin}/@${profile.username}`
    : null;

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied.");
  };

  return (
    <AppShell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl">Shipped</h1>
            <p className="mt-1 text-muted-foreground">
              The only page here that measures results instead of effort.
            </p>
          </div>

          {profile?.publicProfile && shareUrl ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={copyShareUrl}>
                <Share2 className="mr-2 size-4" aria-hidden />
                Copy public link
              </Button>
              <Button asChild variant="ghost">
                <a
                  href={`/@${profile.username}`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Globe className="mr-2 size-4" aria-hidden />
                  View
                </a>
              </Button>
              <Button asChild variant="ghost">
                <a
                  href={`/@${profile.username}/feed.xml`}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Rss className="mr-2 size-4" aria-hidden />
                  RSS
                </a>
              </Button>
            </div>
          ) : (
            <Button asChild variant="outline">
              <Link href="/settings">
                <Globe className="mr-2 size-4" aria-hidden />
                Make this shelf public
              </Link>
            </Button>
          )}
        </div>

        {isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-28" />
            ))}
          </div>
        ) : pieces && pieces.length > 0 ? (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Pieces shipped" value={pieces.length} />
              <Stat
                label={`Shipped in ${thisYear}`}
                value={thisYearPieces.length}
              />
              <Stat
                label="Words published"
                value={totalWords.toLocaleString()}
              />
            </div>

            <Button
              variant="outline"
              onClick={() =>
                downloadShareCard({
                  name: profile?.name ?? "A writer",
                  handle: profile?.username ?? null,
                  pieces: thisYearPieces.length,
                  words: thisYearPieces.reduce(
                    (sum, idea) => sum + idea.wordCount,
                    0
                  ),
                  year: thisYear,
                })
              }
            >
              <ImageDown className="mr-2 size-4" aria-hidden />
              Save a card for {thisYear}
            </Button>

            <ul className="space-y-3">
              {pieces.map(idea => (
                <li key={idea.id}>
                  {/* A catalogue entry: a green spine down the left, the way a
                      finished thing gets filed. */}
                  <Card className="border-l-4 border-l-sage p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/ideas/${idea.id}`}
                          className="font-serif text-lg hover:text-primary"
                        >
                          {idea.title}
                        </Link>
                        {idea.description && (
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {idea.description}
                          </p>
                        )}
                        <p className="typewriter mt-2 text-muted-foreground">
                          {idea.publishedAt?.toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          {idea.publishedIn && ` · ${idea.publishedIn}`}
                          {idea.wordCount > 0 &&
                            ` · ${idea.wordCount.toLocaleString()} words`}
                        </p>
                      </div>

                      {idea.publishedUrl && (
                        <Button asChild variant="outline" size="sm">
                          <a
                            href={idea.publishedUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            <ExternalLink
                              className="mr-2 size-3.5"
                              aria-hidden
                            />
                            Read
                          </a>
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Card className="p-12 text-center">
            <p className="mb-2 text-lg">Nothing on the shelf yet.</p>
            <p className="mb-6 text-muted-foreground">
              When a piece goes out, open it and hit <em>Ship it</em>. This page
              is where it lands.
            </p>
            <Button asChild variant="outline">
              <Link href="/ideas">Go to your ideas</Link>
            </Button>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="panel gap-0 border-sage/35 bg-sage/8 px-5 py-4 text-sage">
      <p className="typewriter text-muted-foreground">{label}</p>
      <p className="typewriter-num mt-1 text-3xl">{value}</p>
    </Card>
  );
}
