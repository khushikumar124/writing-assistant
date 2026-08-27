import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="text-center">
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          404
        </p>
        <h1 className="mb-3 text-3xl md:text-4xl">This page doesn't exist.</h1>
        <p className="mb-8 text-muted-foreground">
          Not every draft finds a home. This one certainly didn't.
        </p>
        <Button asChild>
          <Link href="/">Back to the dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
