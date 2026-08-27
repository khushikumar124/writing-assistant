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
import { Skeleton } from "@/components/ui/skeleton";
import { relativeTime } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { RotateCcw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * The bin. Deleting anywhere in the app lands here rather than destroying
 * anything, and this is the only place a permanent delete can happen.
 */
export default function Trash() {
  const [confirmingEmpty, setConfirmingEmpty] = useState(false);

  const utils = trpc.useUtils();
  const { data: ideas, isPending: ideasPending } =
    trpc.ideas.listDeleted.useQuery();
  const { data: thoughts, isPending: thoughtsPending } =
    trpc.thoughts.listDeleted.useQuery();

  const refresh = () =>
    Promise.all([
      utils.ideas.listDeleted.invalidate(),
      utils.thoughts.listDeleted.invalidate(),
      utils.ideas.list.invalidate(),
      utils.thoughts.list.invalidate(),
      utils.stats.dashboard.invalidate(),
    ]);

  const restoreIdea = trpc.ideas.restore.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Idea restored.");
    },
    onError: error => toast.error(error.message),
  });

  const restoreThought = trpc.thoughts.restore.useMutation({
    onSuccess: async () => {
      await refresh();
      toast.success("Thought restored.");
    },
    onError: error => toast.error(error.message),
  });

  const emptyTrash = trpc.ideas.emptyTrash.useMutation({
    onSuccess: async result => {
      await refresh();
      setConfirmingEmpty(false);
      toast.success(
        `Removed ${result.purged} item${result.purged === 1 ? "" : "s"} for good.`
      );
    },
    onError: error => toast.error(error.message),
  });

  const isPending = ideasPending || thoughtsPending;
  const total = (ideas?.length ?? 0) + (thoughts?.length ?? 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl">The bin</h1>
            <p className="mt-1 text-muted-foreground">
              Everything here is recoverable for 30 days.
            </p>
          </div>
          {total > 0 && (
            <Button variant="outline" onClick={() => setConfirmingEmpty(true)}>
              <Trash2 className="mr-2 size-4" aria-hidden />
              Empty the bin
            </Button>
          )}
        </div>

        {isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }, (_, index) => (
              <Skeleton key={index} className="h-20" />
            ))}
          </div>
        ) : total === 0 ? (
          <Card className="p-12 text-center text-muted-foreground">
            The bin is empty.
          </Card>
        ) : (
          <div className="space-y-3">
            {ideas?.map(idea => (
              <Card
                key={`idea-${idea.id}`}
                className="flex items-start gap-4 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{idea.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Idea · deleted {relativeTime(idea.deletedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => restoreIdea.mutate({ id: idea.id })}
                >
                  <RotateCcw className="mr-2 size-3.5" aria-hidden />
                  Restore
                </Button>
              </Card>
            ))}

            {thoughts?.map(thought => (
              <Card
                key={`thought-${thought.id}`}
                className="flex items-start gap-4 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm leading-relaxed">
                    {thought.content}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Thought · deleted {relativeTime(thought.deletedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => restoreThought.mutate({ id: thought.id })}
                >
                  <RotateCcw className="mr-2 size-3.5" aria-hidden />
                  Restore
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={confirmingEmpty} onOpenChange={setConfirmingEmpty}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Empty the bin?</DialogTitle>
            <DialogDescription>
              This removes {total} item{total === 1 ? "" : "s"} permanently. It
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmingEmpty(false)}>
              Keep them
            </Button>
            <Button
              variant="destructive"
              disabled={emptyTrash.isPending}
              onClick={() => emptyTrash.mutate()}
            >
              {emptyTrash.isPending ? "Removing…" : "Delete forever"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
