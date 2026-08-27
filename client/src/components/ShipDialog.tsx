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
import { trpc } from "@/lib/trpc";
import type { Idea } from "@shared/types";
import { useState } from "react";
import { toast } from "sonner";

/**
 * The moment the whole app is pointed at.
 *
 * Marking something shipped records where and when, not just a status flag —
 * the shelf is only worth keeping if it remembers the details, and the details
 * are what make a public shelf worth sharing.
 */
export default function ShipDialog({
  idea,
  open,
  onClose,
}: {
  idea: Idea;
  open: boolean;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(idea.publishedUrl ?? "");
  const [publishedIn, setPublishedIn] = useState(idea.publishedIn ?? "");

  const utils = trpc.useUtils();

  const ship = trpc.ideas.markShipped.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.ideas.get.invalidate({ id: idea.id }),
        utils.ideas.list.invalidate(),
        utils.ideas.listPublished.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);
      onClose();
      toast.success("On the shelf. That's the part that counts.");
    },
    onError: error => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark as shipped</DialogTitle>
          <DialogDescription>
            Where did it go out? Both fields are optional — a piece counts as
            shipped whether or not it has a link.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ship-url">Link</Label>
            <Input
              id="ship-url"
              type="url"
              inputMode="url"
              value={url}
              onChange={event => setUrl(event.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ship-where">Published in</Label>
            <Input
              id="ship-where"
              value={publishedIn}
              onChange={event => setPublishedIn(event.target.value)}
              placeholder="Substack, my blog, a newsletter…"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={ship.isPending}
              onClick={() =>
                ship.mutate({
                  id: idea.id,
                  url: url.trim() || null,
                  publishedIn: publishedIn.trim(),
                })
              }
            >
              {ship.isPending ? "Saving…" : "Mark shipped"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
