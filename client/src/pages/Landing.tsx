import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Combine, Feather, Send } from "lucide-react";
import { Link } from "wouter";

const FEATURES = [
  {
    icon: Feather,
    title: "Catch it anywhere",
    body: "A thought box one keystroke away, on every page, on your phone's share sheet, and offline. Tag it or don't — sorting is a later problem.",
  },
  {
    icon: Combine,
    title: "Forge the pile into a piece",
    body: "Select the scattered notes that belong together and turn them into one idea. They stay beside you in the editor as raw material while you write.",
  },
  {
    icon: Send,
    title: "Keep score of what shipped",
    body: "Mark a piece as published and it lands on your shelf, with the date and the link. Share the shelf, or keep it to yourself.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Feather className="size-5 text-primary" aria-hidden />
            <span className="font-semibold tracking-tight text-primary">
              Nook
            </span>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/signin">Sign in</Link>
          </Button>
        </div>
      </header>

      <section className="container py-20 md:py-28">
        <div className="max-w-2xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            For people who write around a day job
          </p>
          <h1 className="mb-6 text-balance text-5xl leading-tight md:text-6xl">
            Somewhere to put the thought before it's an essay.
          </h1>
          <p className="mb-8 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Most writing dies in the gap between having an idea and sitting down
            to write it. This is a quiet workspace for that gap — catch the
            mess, build pieces out of it, and keep track of what you actually
            shipped.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/signin">
                Start writing
                <ArrowRight className="ml-2 size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/signin?demo=1">Try it without an account</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <Card key={title} className="card-lift border border-border p-6">
              <Icon className="mb-3 size-6 text-primary" aria-hidden />
              <h2 className="mb-2 text-lg font-semibold">{title}</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {body}
              </p>
            </Card>
          ))}
        </div>

        <div className="mt-20 max-w-2xl border-l-2 border-primary/30 pl-6">
          <h2 className="mb-3 text-2xl">No AI writes for you here.</h2>
          <p className="leading-relaxed text-muted-foreground">
            Every prompt in this app was written by a person. Nothing suggests
            your next sentence, nothing rewrites your paragraph, and nothing
            reads your drafts to make recommendations. The thinking is the part
            worth keeping — this just makes room for it.
          </p>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="container flex h-16 flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>
            Your drafts stay private. Only what you ship can be made public.
          </span>
          <span className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
