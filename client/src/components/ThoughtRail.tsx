import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { relativeTime } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { Plus, Unlink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * The raw material for one piece, beside the piece itself.
 *
 * This is the bridge the app is built around: the notes that led to an idea
 * stay visible while you write it, instead of being lost in a pile the moment
 * the draft exists. Clicking a thought drops its text into the draft.
 */
export default function ThoughtRail({
  ideaId,
  onInsert,
}: {
  ideaId: number;
  onInsert: (text: string) => void;
}) {
  const [attaching, setAttaching] = useState(false);
  const utils = trpc.useUtils();

  const { data: thoughts = [] } = trpc.thoughts.listForIdea.useQuery({
    ideaId,
  });

  const unlink = trpc.thoughts.link.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.thoughts.listForIdea.invalidate({ ideaId }),
        utils.thoughts.listUnlinked.invalidate(),
        utils.thoughts.list.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  return (
    <aside className="w-full shrink-0 border-t border-border px-6 py-6 lg:w-80 lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Raw material
        </h2>
        <Button size="sm" variant="ghost" onClick={() => setAttaching(true)}>
          <Plus className="size-4" aria-hidden />
          <span className="sr-only">Attach a thought</span>
        </Button>
      </div>

      {thoughts.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          No thoughts attached yet. Pull one in and it'll sit here while you
          write.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {thoughts.map(thought => (
            <li
              key={thought.id}
              className="group rounded-lg border border-border bg-muted/30 p-3"
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {thought.content}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {relativeTime(thought.createdAt)}
                </span>
                <div className="flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => onInsert(thought.content)}
                  >
                    Insert
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2"
                    aria-label="Detach thought"
                    onClick={() =>
                      unlink.mutate({ ids: [thought.id], ideaId: null })
                    }
                  >
                    <Unlink className="size-3.5" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AttachDialog
        open={attaching}
        ideaId={ideaId}
        onClose={() => setAttaching(false)}
      />
    </aside>
  );
}

/** Picks from the unsorted pile to attach more raw material mid-draft. */
function AttachDialog({
  open,
  ideaId,
  onClose,
}: {
  open: boolean;
  ideaId: number;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const { data: available = [] } = trpc.thoughts.listUnlinked.useQuery(
    undefined,
    {
      enabled: open,
    }
  );

  const link = trpc.thoughts.link.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.thoughts.listForIdea.invalidate({ ideaId }),
        utils.thoughts.listUnlinked.invalidate(),
        utils.thoughts.list.invalidate(),
      ]);
      onClose();
      toast.success("Attached.");
    },
    onError: error => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={next => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Attach a thought</DialogTitle>
          <DialogDescription>
            Anything from the pile that isn't already feeding an idea.
          </DialogDescription>
        </DialogHeader>

        {available.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nothing spare in the pile right now.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {available.map(thought => (
              <li key={thought.id}>
                <button
                  onClick={() => link.mutate({ ids: [thought.id], ideaId })}
                  disabled={link.isPending}
                  className="w-full rounded-lg border border-border p-3 text-left text-sm leading-relaxed transition-colors hover:border-primary hover:bg-primary/5"
                >
                  {thought.content}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
