import AppShell from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { relativeTime, statusClasses, statusLabel } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { IDEA_STATUSES } from "@shared/types";
import { Archive, ArchiveRestore, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

// "archived" is not a status — it is a separate list, and sits last so the
// status filters stay together.
const FILTERS = ["all", ...IDEA_STATUSES, "archived"] as const;
type Filter = (typeof FILTERS)[number];

export default function Ideas() {
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);

  const utils = trpc.useUtils();
  const showingArchive = filter === "archived";
  const { data: ideas, isPending } = trpc.ideas.list.useQuery(undefined, {
    enabled: !showingArchive,
  });
  const { data: archived, isPending: archivePending } =
    trpc.ideas.listArchived.useQuery(undefined, { enabled: showingArchive });
  const { data: categories = [] } = trpc.categories.list.useQuery();

  const restore = trpc.ideas.restore.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.ideas.list.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const setArchived = trpc.ideas.setArchived.useMutation({
    onSuccess: async result => {
      await Promise.all([
        utils.ideas.list.invalidate(),
        utils.ideas.listArchived.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);
      toast(result.archived ? "Archived." : "Back in your ideas.", {
        action: {
          label: "Undo",
          onClick: () =>
            setArchived.mutate({ id: result.id, archived: !result.archived }),
        },
      });
    },
    onError: error => toast.error(error.message),
  });

  const remove = trpc.ideas.delete.useMutation({
    // Without this the list kept showing deleted rows until a manual refresh.
    onSuccess: async result => {
      await Promise.all([
        utils.ideas.list.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);
      // A draft is somebody's work — deleting moves it to the bin, and the
      // toast is the fastest way back.
      toast("Moved to the bin.", {
        action: {
          label: "Undo",
          onClick: () => restore.mutate({ id: result.id }),
        },
      });
    },
    onError: error => toast.error(error.message),
  });

  const visible = showingArchive
    ? archived
    : filter === "all"
      ? ideas
      : ideas?.filter(idea => idea.status === filter);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl">Ideas</h1>
            <p className="mt-1 text-muted-foreground">
              Things you've decided are worth writing.
            </p>
          </div>
          <Button onClick={() => setShowForm(value => !value)}>
            <Plus className="mr-2 size-4" aria-hidden />
            New idea
          </Button>
        </div>

        {showForm && (
          <NewIdeaForm
            categories={categories}
            onDone={() => setShowForm(false)}
          />
        )}

        <div className="flex flex-wrap gap-2">
          {FILTERS.map(value => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              onClick={() => setFilter(value)}
            >
              {value === "all"
                ? "All"
                : value === "archived"
                  ? "Archived"
                  : statusLabel(value)}
            </Button>
          ))}
        </div>

        {(showingArchive ? archivePending : isPending) ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-36" />
            ))}
          </div>
        ) : visible && visible.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {visible.map(idea => (
              <Card
                key={idea.id}
                className="card-lift relative flex flex-col p-5"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  {/*
                   * The overlay stretches this one link across the whole card,
                   * so anywhere on it opens the editor. Keeping it a real link
                   * on the title means the accessible name is the title, and
                   * middle-click and "open in new tab" still work.
                   */}
                  <Link
                    href={`/ideas/${idea.id}`}
                    className="font-semibold after:absolute after:inset-0 after:content-[''] hover:text-primary"
                  >
                    {idea.title}
                  </Link>
                  {/* Above the overlay, or the card would swallow these. */}
                  <div className="relative z-10 flex shrink-0 items-center gap-1">
                    <button
                      onClick={() =>
                        setArchived.mutate({
                          id: idea.id,
                          archived: !showingArchive,
                        })
                      }
                      disabled={setArchived.isPending}
                      className="text-muted-foreground transition-colors hover:text-primary"
                      aria-label={`${showingArchive ? "Unarchive" : "Archive"} ${idea.title}`}
                      title={showingArchive ? "Put back" : "Archive"}
                    >
                      {showingArchive ? (
                        <ArchiveRestore className="size-4" aria-hidden />
                      ) : (
                        <Archive className="size-4" aria-hidden />
                      )}
                    </button>
                    <button
                      onClick={() => remove.mutate({ id: idea.id })}
                      disabled={remove.isPending}
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={`Delete ${idea.title}`}
                      title="Delete"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>

                {idea.description && (
                  <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                    {idea.description}
                  </p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 text-xs">
                  <span className={cn("shrink-0", statusClasses(idea.status))}>
                    {statusLabel(idea.status)}
                  </span>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                    {idea.category}
                  </span>
                  <span className="ml-auto text-muted-foreground">
                    {idea.wordCount > 0 && `${idea.wordCount} words · `}
                    {relativeTime(idea.updatedAt)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground">
              {filter === "all"
                ? "No ideas yet. Start one above, or promote a thought."
                : `Nothing marked "${statusLabel(filter)}".`}
            </p>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function NewIdeaForm({
  categories,
  onDone,
}: {
  categories: { id: number; name: string }[];
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0]?.name ?? "");
  const [customCategory, setCustomCategory] = useState(categories.length === 0);

  const utils = trpc.useUtils();
  const [, navigate] = useLocation();
  const addCategory = trpc.categories.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.categories.list.invalidate(),
        utils.categories.listWithUsage.invalidate(),
      ]);
    },
  });
  const create = trpc.ideas.create.useMutation({
    onSuccess: async idea => {
      await Promise.all([
        utils.ideas.list.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);
      onDone();
      // Straight into the editor. Naming a piece is not the thing you sat
      // down to do, and stopping at the form makes you find it again to start.
      navigate(`/ideas/${idea.id}`);
    },
    onError: error => toast.error(error.message),
  });

  const chosenCategory = category || categories[0]?.name || "";

  return (
    <Card className="border-primary/20 p-6">
      <form
        className="space-y-4"
        onSubmit={event => {
          event.preventDefault();
          if (!title.trim() || !chosenCategory) return;
          void (async () => {
            const name = chosenCategory.trim();
            const isNew = !categories.some(option => option.name === name);
            if (isNew) {
              // Best effort: if this fails the idea still saves, it just
              // will not have a matching entry in the category list.
              try {
                await addCategory.mutateAsync({ name });
              } catch {
                /* a duplicate name is fine — the idea still files correctly */
              }
            }
            create.mutate({
              title: title.trim(),
              description: description.trim() || undefined,
              category: name,
            });
          })();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="idea-title">Title</Label>
          <Input
            id="idea-title"
            autoFocus
            value={title}
            onChange={event => setTitle(event.target.value)}
            placeholder="What's the piece about?"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="idea-description">Description (optional)</Label>
          <Textarea
            id="idea-description"
            rows={2}
            value={description}
            onChange={event => setDescription(event.target.value)}
            placeholder="A sentence on the angle, so future-you remembers."
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="idea-category">Category</Label>
            {categories.length > 0 && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
                onClick={() => {
                  setCustomCategory(value => !value);
                  setCategory("");
                }}
              >
                {customCategory ? "Pick an existing one" : "New category"}
              </button>
            )}
          </div>
          {categories.length > 0 && !customCategory ? (
            <Select value={chosenCategory} onValueChange={setCategory}>
              <SelectTrigger id="idea-category">
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
            // Categories are the writer's own, so one can be invented here
            // rather than only in settings — the interruption is the point to
            // avoid, since naming a category is not why you opened this form.
            <Input
              id="idea-category"
              value={category}
              onChange={event => setCategory(event.target.value)}
              placeholder="Recipes, Letters, Field notes…"
              maxLength={100}
            />
          )}
        </div>

        <div className="flex gap-2">
          <Button
            type="submit"
            disabled={!title.trim() || !chosenCategory || create.isPending}
          >
            {create.isPending ? "Saving…" : "Save idea"}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
