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
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const FILTERS = ["all", ...IDEA_STATUSES] as const;
type Filter = (typeof FILTERS)[number];

export default function Ideas() {
  const [filter, setFilter] = useState<Filter>("all");
  const [showForm, setShowForm] = useState(false);

  const utils = trpc.useUtils();
  const { data: ideas, isPending } = trpc.ideas.list.useQuery();
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

  const visible =
    filter === "all" ? ideas : ideas?.filter(idea => idea.status === filter);

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
              {value === "all" ? "All" : statusLabel(value)}
            </Button>
          ))}
        </div>

        {isPending ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-36" />
            ))}
          </div>
        ) : visible && visible.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {visible.map(idea => (
              <Card key={idea.id} className="card-lift flex flex-col p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <Link
                    href={`/ideas/${idea.id}`}
                    className="font-semibold hover:text-primary"
                  >
                    {idea.title}
                  </Link>
                  <button
                    onClick={() => remove.mutate({ id: idea.id })}
                    disabled={remove.isPending}
                    className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                    aria-label={`Delete ${idea.title}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>

                {idea.description && (
                  <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">
                    {idea.description}
                  </p>
                )}

                <div className="mt-auto flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "shrink-0",
                      statusClasses(idea.status)
                    )}
                  >
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

  const utils = trpc.useUtils();
  const create = trpc.ideas.create.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.ideas.list.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);
      toast.success("Idea saved.");
      onDone();
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
          create.mutate({
            title: title.trim(),
            description: description.trim() || undefined,
            category: chosenCategory,
          });
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
          <Label htmlFor="idea-category">Category</Label>
          {categories.length > 0 ? (
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
            // Categories are user-defined, so a brand-new account types its own.
            <Input
              id="idea-category"
              value={category}
              onChange={event => setCategory(event.target.value)}
              placeholder="Name a category"
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
