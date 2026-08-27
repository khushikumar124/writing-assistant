import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { PASSWORD_MIN_LENGTH } from "@shared/const";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

export default function Settings() {
  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-8">
        <div>
          <h1 className="text-3xl md:text-4xl">Settings</h1>
          <p className="mt-1 text-muted-foreground">
            Your account and your shelf.
          </p>
        </div>

        <ProfileSection />
        <AppearanceSection />
        <PasswordSection />
        <DataSection />
      </div>
    </AppShell>
  );
}

function ProfileSection() {
  const utils = trpc.useUtils();
  const { data: profile } = trpc.profile.mine.useQuery();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Seed the form once the profile arrives.
  useEffect(() => {
    if (!profile) return;
    setName(profile.name ?? "");
    setUsername(profile.username ?? "");
    setBio(profile.bio ?? "");
    setIsPublic(profile.publicProfile);
  }, [profile]);

  const update = trpc.profile.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.profile.mine.invalidate(),
        utils.auth.me.invalidate(),
      ]);
      toast.success("Saved.");
    },
    onError: error => toast.error(error.message),
  });

  const shelfUrl = username ? `${window.location.origin}/@${username}` : null;

  return (
    <Card className="space-y-5 p-6">
      <div>
        <h2 className="text-xl">Profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Only what you publish is ever visible to anyone else. Drafts,
          thoughts, and streaks are always private.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="settings-name">Name</Label>
        <Input
          id="settings-name"
          value={name}
          onChange={event => setName(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="settings-username">Handle</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">@</span>
          <Input
            id="settings-username"
            value={username}
            onChange={event => setUsername(event.target.value.toLowerCase())}
            placeholder="yourname"
          />
        </div>
        {shelfUrl && (
          <p className="text-xs text-muted-foreground">
            Your shelf would live at{" "}
            <span className="font-mono">{shelfUrl}</span>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="settings-bio">Bio</Label>
        <Textarea
          id="settings-bio"
          rows={3}
          maxLength={280}
          value={bio}
          onChange={event => setBio(event.target.value)}
          placeholder="A line about what you write."
        />
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-4">
        <div>
          <Label htmlFor="settings-public" className="text-base">
            Public shelf
          </Label>
          <p className="mt-1 text-sm text-muted-foreground">
            Publishes a page listing only the pieces you've marked as shipped.
            Off by default.
          </p>
        </div>
        <Switch
          id="settings-public"
          checked={isPublic}
          onCheckedChange={setIsPublic}
          disabled={!username}
        />
      </div>

      <Button
        disabled={update.isPending}
        onClick={() =>
          update.mutate({
            name: name.trim() || undefined,
            bio: bio.trim(),
            username: username.trim() || null,
            publicProfile: isPublic,
          })
        }
      >
        {update.isPending ? "Saving…" : "Save profile"}
      </Button>
    </Card>
  );
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-xl">Appearance</h2>
      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="settings-dark" className="text-base">
            Dark mode
          </Label>
          <p className="mt-1 text-sm text-muted-foreground">
            Easier on the eyes for early mornings and late nights.
          </p>
        </div>
        <Switch
          id="settings-dark"
          checked={theme === "dark"}
          onCheckedChange={checked => setTheme(checked ? "dark" : "light")}
        />
      </div>
    </Card>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  const change = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setCurrent("");
      setNext("");
      toast.success("Password changed.");
    },
    onError: error => toast.error(error.message),
  });

  return (
    <Card className="space-y-5 p-6">
      <h2 className="text-xl">Password</h2>

      <div className="space-y-2">
        <Label htmlFor="settings-current">Current password</Label>
        <Input
          id="settings-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={event => setCurrent(event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="settings-next">New password</Label>
        <Input
          id="settings-next"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={next}
          onChange={event => setNext(event.target.value)}
          placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`}
        />
      </div>

      <Button
        variant="outline"
        disabled={
          !current || next.length < PASSWORD_MIN_LENGTH || change.isPending
        }
        onClick={() =>
          change.mutate({ currentPassword: current, newPassword: next })
        }
      >
        {change.isPending ? "Changing…" : "Change password"}
      </Button>
    </Card>
  );
}

function DataSection() {
  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-xl">Your writing</h2>
      <p className="text-sm text-muted-foreground">
        Deleted ideas and thoughts sit in the bin for 30 days before they're
        removed for good.
      </p>
      <Button asChild variant="outline">
        <Link href="/trash">Open the bin</Link>
      </Button>
    </Card>
  );
}
