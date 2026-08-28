import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { Download, Loader2 } from "lucide-react";
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
        <GoalSection />
        <AppearanceSection />
        <DataSection />
        <DangerSection />
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

/**
 * A daily words target.
 *
 * Framed as encouragement rather than obligation: it is off unless asked for,
 * the presets are small, and nothing anywhere scolds you for missing it. A goal
 * that produces guilt makes people close the tab, which is the opposite of what
 * it is for.
 */
function GoalSection() {
  const utils = trpc.useUtils();
  const { data: preferences } = trpc.categories.getPreferences.useQuery();
  const [draft, setDraft] = useState<string>("");

  useEffect(() => {
    if (preferences) setDraft(String(preferences.dailyWordGoal || ""));
  }, [preferences]);

  const update = trpc.categories.updatePreferences.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.categories.getPreferences.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);
      toast.success("Saved.");
    },
    onError: error => toast.error(error.message),
  });

  const save = (value: number) =>
    update.mutate({ dailyWordGoal: Math.max(0, Math.min(20_000, value)) });

  const current = preferences?.dailyWordGoal ?? 0;

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-xl">A daily goal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional, and quiet. If you set one, the editor shows a small bar as
          you go. Nothing here will ever tell you off for missing it.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[0, 100, 250, 500, 1000].map(preset => (
          <Button
            key={preset}
            size="sm"
            variant={current === preset ? "default" : "outline"}
            onClick={() => save(preset)}
          >
            {preset === 0 ? "No goal" : `${preset} words`}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-2">
          <Label htmlFor="goal-custom">Or your own number</Label>
          <Input
            id="goal-custom"
            inputMode="numeric"
            className="w-40"
            value={draft}
            onChange={event =>
              setDraft(event.target.value.replace(/[^0-9]/g, ""))
            }
            placeholder="e.g. 300"
          />
        </div>
        <Button
          variant="outline"
          disabled={update.isPending}
          onClick={() => save(Number(draft || 0))}
        >
          Set goal
        </Button>
      </div>
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

function DataSection() {
  const [downloading, setDownloading] = useState(false);
  const utils = trpc.useUtils();

  /**
   * Fetched on demand rather than with a live query: this is a file someone
   * asks for once, not state the page needs to hold.
   */
  const download = async () => {
    setDownloading(true);
    try {
      const data = await utils.account.exportData.fetch();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `writing-assistant-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Downloaded.");
    } catch {
      toast.error("Couldn't build the export. Try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="space-y-4 p-6">
      <h2 className="text-xl">Your writing</h2>
      <p className="text-sm text-muted-foreground">
        Deleted ideas and thoughts sit in the bin for 30 days before they're
        removed for good.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link href="/trash">Open the bin</Link>
        </Button>
        <Button variant="outline" onClick={download} disabled={downloading}>
          {downloading ? (
            <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="mr-2 size-4" aria-hidden />
          )}
          Download everything
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        One JSON file with every thought, idea and draft — including what's in
        the bin.
      </p>
    </Card>
  );
}

/**
 * Deleting an account is the one action in the app with no undo, so it asks for
 * the account's own email address rather than a generic "DELETE" that muscle
 * memory can type without reading.
 */
function DangerSection() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");

  const { data: profile } = trpc.profile.mine.useQuery();
  const { logout } = useAuth();
  const utils = trpc.useUtils();

  const remove = trpc.account.delete.useMutation({
    onSuccess: async () => {
      setOpen(false);
      // The server already cleared the cookie; this resets the client to match
      // and lands on the marketing page rather than a broken dashboard.
      utils.auth.me.setData(undefined, null);
      await utils.invalidate();
      window.location.href = "/";
    },
    onError: error => toast.error(error.message),
  });

  const email = profile?.email ?? "";
  const matches = confirmation.trim().toLowerCase() === email.toLowerCase();

  return (
    <Card className="space-y-4 border-destructive/40 p-6">
      <h2 className="text-xl text-destructive">Delete your account</h2>
      <p className="text-sm text-muted-foreground">
        This removes your account and every thought, idea and draft in it,
        immediately and permanently. It cannot be undone, and we cannot recover
        it for you afterwards. Download your writing first if you want to keep
        it.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
        <Button variant="ghost" onClick={() => void logout()}>
          Just sign out
        </Button>
      </div>

      <Dialog
        open={open}
        onOpenChange={next => {
          if (!next) setConfirmation("");
          setOpen(next);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account for good?</DialogTitle>
            <DialogDescription>
              Everything goes: your thoughts, your ideas, your drafts, your
              shipped shelf, and your public page if you have one. There is no
              recovery.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirm-delete">
                Type <span className="font-mono text-foreground">{email}</span>{" "}
                to confirm
              </Label>
              <Input
                id="confirm-delete"
                autoComplete="off"
                value={confirmation}
                onChange={event => setConfirmation(event.target.value)}
                placeholder={email}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Keep my account
              </Button>
              <Button
                variant="destructive"
                disabled={!matches || remove.isPending}
                onClick={() => remove.mutate({ confirmation })}
              >
                {remove.isPending ? "Deleting…" : "Delete everything"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
