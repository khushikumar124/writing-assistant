import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Feather, Loader2 } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { Link, useLocation, useSearch } from "wouter";

/**
 * One way in.
 *
 * Google sign-in is a browser redirect to `/api/auth/google`, not a form post,
 * so there is nothing to submit here — the page is a door rather than a
 * questionnaire.
 */
export default function SignIn() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();

  const { data: demoAvailable } = trpc.auth.demoAvailable.useQuery();
  const { data: googleAvailable } = trpc.auth.googleAvailable.useQuery();

  const sandbox = trpc.auth.startSandbox.useMutation({
    onSuccess: async user => {
      utils.auth.me.setData(undefined, user as never);
      await utils.invalidate();
      navigate("/");
      toast.success(`Welcome${user.name ? `, ${user.name}` : ""}.`);
    },
    onError: error => toast.error(error.message),
  });

  const wantsDemo = new URLSearchParams(search).has("demo");

  // Google sign-in fails by redirecting back here with a code, since a failed
  // redirect has nowhere else to report itself.
  useEffect(() => {
    const code = new URLSearchParams(search).get("error");
    if (!code) return;

    const messages: Record<string, string> = {
      cancelled: "Google sign-in was cancelled.",
      email_unverified:
        "That Google account has an unverified email address, so we can't use it to sign in.",
      sandbox_conflict:
        "That address belongs to a temporary sandbox. Sign out of the sandbox first.",
      google_unavailable: "Google sign-in isn't set up on this server.",
      rate_limited: "Too many attempts. Try again in a few minutes.",
    };
    toast.error(messages[code] ?? "Google sign-in didn't work. Try again.");
    navigate("/signin", { replace: true });
  }, [search, navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <Feather className="size-5 text-primary" aria-hidden />
          <span className="font-semibold tracking-tight text-primary">
            Writing Assistant
          </span>
        </Link>

        <Card className="p-8">
          <h1 className="mb-1 text-2xl">Welcome</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Sign in with Google. There's no password to make up or forget.
          </p>

          {googleAvailable ? (
            /* A plain link, not a fetch: OAuth needs a real top-level
               navigation so the browser can follow Google's redirects. */
            <Button asChild size="lg" className="w-full">
              <a href="/api/auth/google">
                <GoogleMark />
                <span className="ml-2">Continue with Google</span>
              </a>
            </Button>
          ) : (
            <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Google sign-in isn't configured on this server yet.
            </p>
          )}

          {demoAvailable && (
            <>
              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  or
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button
                variant="outline"
                className="w-full"
                autoFocus={wantsDemo}
                disabled={sandbox.isPending}
                onClick={() => sandbox.mutate()}
              >
                {sandbox.isPending && (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                )}
                Try it without an account
              </Button>
              <p className="mt-2 text-center text-xs text-muted-foreground">
                A private sandbox with sample writing, just for you. It clears
                itself after a day.
              </p>
            </>
          )}
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          We only ever see your name, email address and profile picture.
        </p>
      </div>
    </div>
  );
}

/** Google's "G", inline so the button needs no remote asset. */
function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
