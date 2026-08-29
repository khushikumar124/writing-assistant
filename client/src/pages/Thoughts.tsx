import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { parseTags, relativeTime } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import type { RawThought } from "@shared/types";
import { Archive, ArchiveRestore, Combine, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function Thoughts() {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [merging, setMerging] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [showArchive, setShowArchive] = useState(false);

  const utils = trpc.useUtils();
  const { data: live, isPending: livePending } = trpc.thoughts.list.useQuery(
    undefined,
    { enabled: !showArchive }
  );
  const { data: archived, isPending: archivePending } =
    trpc.thoughts.listArchived.useQuery(undefined, { enabled: showArchive });
  const thoughts = showArchive ? archived : live;
  const isPending = showArchive ? archivePending : livePending;

  const restore = trpc.thoughts.restore.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.thoughts.list.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);
    },
  });

  const setArchived = trpc.thoughts.setArchived.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.thoughts.list.invalidate(),
        utils.thoughts.listArchived.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);
      toast(result.archived ? "Archived." : "Back in your thoughts.", {
        action: {
          label: "Undo",
          onClick: () =>
            setArchived.mutate({ id: result.id, archived: !result.archived }),
        },
      });
    },
    onError: error => toast.error(error.message),
  });

  const remove = trpc.thoughts.delete.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.thoughts.list.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);
      // Nothing a writer typed should ever be one misclick from gone.
      toast("Moved to the bin.", {
        action: {
          label: "Undo",
          onClick: () => restore.mutate({ id: result.id }),
        },
      });
    },
    onError: error => toast.error(error.message),
  });

  const allTags = [
    ...new Set((thoughts ?? []).flatMap(t => parseTags(t.tags))),
  ].sort();
  const visible = activeTag
    ? thoughts?.filter(thought => parseTags(thought.tags).includes(activeTag))
    : thoughts;

  const toggle = (id: number) =>
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectedThoughts = (thoughts ?? []).filter(thought =>
    selected.has(thought.id)
  );

  return (
    <AppShell>
      <div className="space-y-6 pb-24">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl">
              {showArchive ? "Archived thoughts" : "Thoughts"}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {showArchive
                ? "Kept, but out of the way. Put any of them back whenever."
                : "The unsorted pile. Select a few that belong together and forge them into one idea."}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowArchive(value => !value);
              setActiveTag(null);
              setSelected(new Set());
            }}
          >
            <Archive className="mr-2 size-4" aria-hidden />
            {showArchive ? "Back to thoughts" : "Archive"}
          </Button>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={activeTag === null ? "default" : "outline"}
              onClick={() => setActiveTag(null)}
            >
              All
            </Button>
            {allTags.map(tag => (
              <Button
                key={tag}
                size="sm"
                variant={activeTag === tag ? "default" : "outline"}
                onClick={() => setActiveTag(tag)}
              >
                {tag}
              </Button>
            ))}
          </div>
        )}

        {isPending ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
        ) : visible && visible.length > 0 ? (
          /* A pinboard, not a list. Notes flow into columns, each one pinned or
             taped down and sitting at a very slight angle — the angle and the
             pin colour both come from nth-child in CSS, so they never shuffle
             on re-render. Every third note gets tape instead of a pin. */
          <div className="board">
            {visible.map((thought, index) => {
              const isSelected = selected.has(thought.id);
              return (
                <div
                  key={thought.id}
                  className={cn(
                    "scrap index-card index-card-margin group relative pb-4 pl-5 pr-5",
                    index % 3 === 2 ? "taped pt-5" : "pinned",
                    isSelected && "scrap-picked"
                  )}
                >
                  <div className="flex gap-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggle(thought.id)}
                      aria-label={`Select thought: ${thought.content.slice(0, 40)}`}
                      className="mt-1 shrink-0"
                    />

                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {thought.content}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="typewriter">
                          {relativeTime(thought.createdAt)}
                        </span>

                        {parseTags(thought.tags).map(tag => (
                          <span
                            key={tag}
                            className="typewriter plate border border-line bg-muted px-1.5 py-0.5"
                          >
                            {tag}
                          </span>
                        ))}

                        {thought.linkedIdeaId && (
                          <Link
                            href={`/ideas/${thought.linkedIdeaId}`}
                            className="font-medium text-primary hover:underline"
                          >
                            → feeding an idea
                          </Link>
                        )}

                        <div className="ml-auto flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              setArchived.mutate({
                                id: thought.id,
                                archived: !showArchive,
                              })
                            }
                            aria-label={
                              showArchive
                                ? "Put thought back"
                                : "Archive thought"
                            }
                            title={showArchive ? "Put back" : "Archive"}
                          >
                            {showArchive ? (
                              <ArchiveRestore
                                className="size-3.5"
                                aria-hidden
                              />
                            ) : (
                              <Archive className="size-3.5" aria-hidden />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => remove.mutate({ id: thought.id })}
                            aria-label="Delete thought"
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" aria-hidden />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              {activeTag
                ? `Nothing tagged "${activeTag}".`
                : "Nothing caught yet. Hit Capture and write the first thing that comes to mind."}
            </p>
          </Card>
        )}
      </div>

      {/* The forge bar: appears only once something is selected. */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
          <div className="container flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-semibold">{selected.size}</span> selected
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
              >
                <X className="mr-2 size-4" aria-hidden />
                Clear
              </Button>
              <Button size="sm" onClick={() => setMerging(true)}>
                <Combine className="mr-2 size-4" aria-hidden />
                {selected.size === 1
                  ? "Make an idea"
                  : `Forge ${selected.size} into one idea`}
              </Button>
            </div>
          </div>
        </div>
      )}

      <MergeDialog
        open={merging}
        thoughts={selectedThoughts}
        onClose={() => setMerging(false)}
        onMerged={() => {
          setSelected(new Set());
          setMerging(false);
        }}
      />
    </AppShell>
  );
}

/**
 * Turns a selection of raw thoughts into one idea. The thoughts stay in the
 * pile and stay linked, so the editor's side rail can show them as raw material
 * while you write.
 */
function MergeDialog({
  open,
  thoughts,
  onClose,
  onMerged,
}: {
  open: boolean;
  thoughts: RawThought[];
  onClose: () => void;
  onMerged: () => void;
}) {
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");

  const utils = trpc.useUtils();
  const { data: categories = [] } = trpc.categories.list.useQuery();

  const merge = trpc.thoughts.mergeIntoIdea.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.thoughts.list.invalidate(),
        utils.ideas.list.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);
      setTitle("");
      setCategory("");
      onMerged();
      toast.success(
        result.merged === 1
          ? "Promoted to an idea."
          : `${result.merged} thoughts forged into one idea.`
      );
      navigate(`/ideas/${result.idea.id}`);
    },
    onError: error => toast.error(error.message),
  });

  // Seed the title from the first thought's opening words.
  const suggested =
    !title && thoughts[0]
      ? thoughts[0].content.split(/\s+/).slice(0, 8).join(" ").slice(0, 80)
      : title;
  const chosenCategory = category || categories[0]?.name || "";

  return (
    <Dialog
      open={open}
      onOpenChange={next => {
        if (!next) {
          setTitle("");
          setCategory("");
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {thoughts.length === 1
              ? "Make this an idea"
              : `Forge ${thoughts.length} thoughts into one idea`}
          </DialogTitle>
          <DialogDescription>
            The thoughts stay where they are and stay linked — you'll see them
            beside you while you write.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-border bg-muted/40 p-3">
            {thoughts.map(thought => (
              <p
                key={thought.id}
                className="line-clamp-2 text-sm text-muted-foreground"
              >
                {thought.content}
              </p>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="merge-title">Title</Label>
            <Input
              id="merge-title"
              value={suggested}
              onChange={event => setTitle(event.target.value)}
              placeholder="What is this piece about?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="merge-category">Category</Label>
            {categories.length > 0 ? (
              <Select value={chosenCategory} onValueChange={setCategory}>
                <SelectTrigger id="merge-category">
                  <SelectValue placeholder="Pick one" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(option => (
                    <SelectItem key={option.id} value={option.name}>
                      {option.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id="merge-category"
                value={category}
                onChange={event => setCategory(event.target.value)}
                placeholder="Name a category"
              />
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={
                thoughts.length === 0 ||
                !suggested.trim() ||
                !chosenCategory ||
                merge.isPending
              }
              onClick={() =>
                merge.mutate({
                  ids: thoughts.map(thought => thought.id),
                  title: suggested.trim(),
                  category: chosenCategory,
                })
              }
            >
              {merge.isPending ? "Creating…" : "Create idea"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
