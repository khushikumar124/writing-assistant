import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { PASSWORD_MIN_LENGTH } from "@shared/const";
import { Feather, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useSearch } from "wouter";

type Mode = "signin" | "signup" | "forgot";

export default function SignIn() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);

  const { data: demoAvailable } = trpc.auth.demoAvailable.useQuery();
  const { data: googleAvailable } = trpc.auth.googleAvailable.useQuery();

  /** Shared success path: prime the cache with the user, then land on the dashboard. */
  const onAuthenticated = async (user: { name: string | null }) => {
    utils.auth.me.setData(undefined, user as never);
    await utils.invalidate();
    navigate("/");
    toast.success(`Welcome${user.name ? `, ${user.name}` : ""}.`);
  };

  const signin = trpc.auth.login.useMutation({
    onSuccess: onAuthenticated,
    onError: error => toast.error(error.message),
  });

  const signup = trpc.auth.signup.useMutation({
    onSuccess: onAuthenticated,
    onError: error => toast.error(error.message),
  });

  const sandbox = trpc.auth.startSandbox.useMutation({
    onSuccess: onAuthenticated,
    onError: error => toast.error(error.message),
  });

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setResetSent(true),
    onError: error => toast.error(error.message),
  });

  const pending =
    signin.isPending ||
    signup.isPending ||
    sandbox.isPending ||
    requestReset.isPending;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === "signin") signin.mutate({ email, password });
    else if (mode === "signup") signup.mutate({ name, email, password });
    else requestReset.mutate({ email });
  };

  // Deep link from the landing page's "try it" button.
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

  const heading =
    mode === "signin"
      ? "Welcome back"
      : mode === "signup"
        ? "Make an account"
        : "Reset password";

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
          <h1 className="mb-1 text-2xl">{heading}</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Pick up where you left off."
              : mode === "signup"
                ? "Your writing stays private. Only what you mark as shipped can ever be made public."
                : "We'll email you a link to choose a new password."}
          </p>

          {mode === "forgot" && resetSent ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed">
                If an account exists for <strong>{email}</strong>, a reset link
                is on its way. The link expires in an hour.
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setResetSent(false);
                  setMode("signin");
                }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={event => setName(event.target.value)}
                    placeholder="Ada Lovelace"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  placeholder="you@example.com"
                />
              </div>

              {mode !== "forgot" && (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                        onClick={() => setMode("forgot")}
                      >
                        Forgot?
                      </button>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    autoComplete={
                      mode === "signin" ? "current-password" : "new-password"
                    }
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={pending}>
                {pending && (
                  <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                )}
                {mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send reset link"}
              </Button>
            </form>
          )}

          {googleAvailable && mode !== "forgot" && (
            <>
              <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">
                  or
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>

              {/* A plain link, not a fetch: OAuth needs a real top-level
                  navigation so the browser can follow Google's redirects. */}
              <Button asChild variant="outline" className="w-full">
                <a href="/api/auth/google">
                  <GoogleMark />
                  <span className="ml-2">Continue with Google</span>
                </a>
              </Button>
            </>
          )}

          {demoAvailable && mode !== "forgot" && (
            <>
              {/* Only label this divider when it is the first one on the card —
                  two stacked "or"s read as a mistake. */}
              {googleAvailable ? (
                <div className="my-4" />
              ) : (
                <div className="my-6 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border" />
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    or
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                autoFocus={wantsDemo}
                disabled={pending}
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

          {mode !== "forgot" && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {mode === "signin" ? "No account yet?" : "Already have one?"}{" "}
              <button
                type="button"
                className="font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? "Create one" : "Sign in"}
              </button>
            </p>
          )}
        </Card>
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
