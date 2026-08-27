import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { trpc } from "@/lib/trpc";
import { Plus, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useLocation, useSearch } from "wouter";

/**
 * The capture layer. Available from every page, openable with Cmd/Ctrl+K, and
 * reachable from the OS share sheet — because the whole point is that catching
 * a thought costs nothing, wherever the thought happens.
 */
export default function CaptureButton() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine);

  const [, navigate] = useLocation();
  const search = useSearch();
  const utils = trpc.useUtils();
  const { enqueue } = useOfflineQueue();

  const createThought = trpc.thoughts.create.useMutation({
    onSuccess: async () => {
      reset();
      toast.success("Caught it.");
      await Promise.all([
        utils.thoughts.list.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);
    },
    onError: error => {
      // The request left but didn't land — keep the text rather than lose it.
      queueLocally(
        `Couldn't reach the server (${error.message}). Saved on this device.`
      );
    },
  });

  const reset = () => {
    setContent("");
    setTags("");
    setOpen(false);
  };

  const parsedTags = () =>
    tags
      .split(",")
      .map(tag => tag.trim())
      .filter(Boolean);

  const queueLocally = (message: string) => {
    enqueue({ content: content.trim(), tags: parsedTags() });
    reset();
    toast(message, {
      description: "It'll sync as soon as you're back online.",
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  /**
   * Opens pre-filled when launched from the OS share sheet or the app shortcut.
   * The manifest's share_target points here with `text`/`url`/`title` params.
   */
  useEffect(() => {
    const params = new URLSearchParams(search);
    const shared = [params.get("title"), params.get("text"), params.get("url")]
      .filter(Boolean)
      .join("\n\n");

    if (shared || params.has("capture")) {
      setContent(shared);
      setOpen(true);
      // Drop the params so a refresh doesn't reopen the box.
      navigate(window.location.pathname, { replace: true });
    }
    // Runs on mount and whenever the query string changes.
  }, [search, navigate]);

  const submit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (!navigator.onLine) {
      queueLocally("Saved on this device.");
      return;
    }

    createThought.mutate({ content: trimmed, tags: parsedTags() });
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden />
        <span className="sr-only sm:not-sr-only sm:ml-2">Capture</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Capture a thought</DialogTitle>
            <DialogDescription>
              Don't tidy it up. You can shape it into something later.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Textarea
              autoFocus
              rows={5}
              value={content}
              onChange={event => setContent(event.target.value)}
              placeholder="What's on your mind?"
              // Cmd/Ctrl+Enter submits, so the whole flow stays on the keyboard.
              onKeyDown={event => {
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter")
                  submit();
              }}
            />

            <div className="space-y-2">
              <Label htmlFor="capture-tags">Tags (optional)</Label>
              <Input
                id="capture-tags"
                value={tags}
                onChange={event => setTags(event.target.value)}
                placeholder="comma, separated"
              />
            </div>

            {!online && (
              <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                <WifiOff className="size-3.5 shrink-0" aria-hidden />
                You're offline. This will be saved here and synced later.
              </p>
            )}

            <div className="flex items-center justify-between">
              <p className="hidden text-xs text-muted-foreground sm:block">
                ⌘↵ to save
              </p>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={submit}
                  disabled={!content.trim() || createThought.isPending}
                >
                  {createThought.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
