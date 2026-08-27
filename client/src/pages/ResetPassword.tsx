import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { PASSWORD_MIN_LENGTH } from "@shared/const";
import { Feather, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useSearch } from "wouter";

/** Landing page for the link in a password reset email. */
export default function ResetPassword() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";

  const [password, setPassword] = useState("");
  const utils = trpc.useUtils();

  const reset = trpc.auth.resetPassword.useMutation({
    onSuccess: async () => {
      // The server signs them in as part of the reset, so land them inside.
      await utils.invalidate();
      navigate("/");
      toast.success("Password updated. You're signed in.");
    },
    onError: error => toast.error(error.message),
  });

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
          <h1 className="mb-1 text-2xl">Choose a new password</h1>

          {token ? (
            <>
              <p className="mb-6 text-sm text-muted-foreground">
                Once you save this, you'll be signed straight in.
              </p>

              <form
                onSubmit={event => {
                  event.preventDefault();
                  reset.mutate({ token, password });
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    required
                    minLength={PASSWORD_MIN_LENGTH}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    password.length < PASSWORD_MIN_LENGTH || reset.isPending
                  }
                >
                  {reset.isPending && (
                    <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                  )}
                  Save password
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="mb-6 text-sm text-muted-foreground">
                This link is missing its token. Ask for a fresh one from the
                sign in page.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/signin">Back to sign in</Link>
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
