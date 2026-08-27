import ShipDialog from "@/components/ShipDialog";
import ThoughtRail from "@/components/ThoughtRail";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countWords, readingTimeMinutes, relativeTime } from "@/lib/format";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { IDEA_STATUSES, type IdeaStatus } from "@shared/types";
import {
  Check,
  ChevronLeft,
  Download,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Send,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link, useParams, useLocation } from "wouter";

const AUTOSAVE_DELAY_MS = 1200;

export default function Editor() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const ideaId = Number.parseInt(params.id ?? "", 10);

  const utils = trpc.useUtils();
  const ideaQuery = trpc.ideas.get.useQuery(
    { id: ideaId },
    { enabled: Number.isInteger(ideaId), retry: false }
  );
  const draftQuery = trpc.drafts.getByIdeaId.useQuery(
    { ideaId },
    { enabled: Number.isInteger(ideaId) }
  );

  const [content, setContent] = useState("");
  /** Content as last confirmed saved, so we never autosave a no-op. */
  const savedContent = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [shipping, setShipping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const save = trpc.drafts.save.useMutation({
    onSuccess: async saved => {
      savedContent.current = saved.content;
      setDirty(false);
      await utils.drafts.getByIdeaId.invalidate({ ideaId });
      await utils.stats.dashboard.invalidate();
    },
    onError: error => toast.error(`Couldn't save: ${error.message}`),
  });

  const updateIdea = trpc.ideas.update.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.ideas.get.invalidate({ id: ideaId }),
        utils.ideas.list.invalidate(),
        utils.stats.dashboard.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  // Seed the editor once the draft arrives, without clobbering in-flight typing.
  useEffect(() => {
    if (draftQuery.data && savedContent.current === null) {
      savedContent.current = draftQuery.data.content;
      setContent(draftQuery.data.content);
    } else if (
      draftQuery.isSuccess &&
      !draftQuery.data &&
      savedContent.current === null
    ) {
      savedContent.current = "";
    }
  }, [draftQuery.data, draftQuery.isSuccess]);

  // Debounced autosave: fires once typing pauses, skips when nothing changed.
  useEffect(() => {
    if (!dirty || savedContent.current === null) return;
    if (content === savedContent.current) return;

    const timer = setTimeout(() => {
      save.mutate({ ideaId, content });
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timer);
    // `save` is intentionally excluded: the mutation object is a new reference
    // on every render and would restart the timer forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, dirty, ideaId]);

  // Warn before losing unsaved work on a tab close.
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const words = useMemo(() => countWords(content), [content]);

  /** Drops a thought's text in at the cursor, rather than at the end. */
  const insertText = (text: string) => {
    const textarea = textareaRef.current;
    const block = `\n\n${text}\n\n`;

    if (!textarea) {
      setContent(current => current + block);
      setDirty(true);
      return;
    }

    const { selectionStart, selectionEnd } = textarea;
    setContent(
      current =>
        current.slice(0, selectionStart) + block + current.slice(selectionEnd)
    );
    setDirty(true);

    // Put the caret after the inserted block once React has re-rendered.
    requestAnimationFrame(() => {
      const caret = selectionStart + block.length;
      textarea.focus();
      textarea.setSelectionRange(caret, caret);
    });
  };

  if (ideaQuery.isError) {
    return (
      <div className="grid min-h-screen place-items-center px-4 text-center">
        <div>
          <h1 className="mb-2 text-2xl">That idea doesn't exist</h1>
          <p className="mb-6 text-muted-foreground">
            It may have been deleted from another tab.
          </p>
          <Button asChild>
            <Link href="/ideas">Back to ideas</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (ideaQuery.isPending || !ideaQuery.data) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2
          className="size-6 animate-spin text-primary"
          aria-label="Loading"
        />
      </div>
    );
  }

  const idea = ideaQuery.data;

  const exportMarkdown = () => {
    const body = `# ${idea.title}\n\n${content}`;
    const url = URL.createObjectURL(
      new Blob([body], { type: "text/markdown" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${idea.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 px-4 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 sm:gap-4">
          <button
            onClick={() => navigate("/ideas")}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted"
            aria-label="Back to ideas"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold">{idea.title}</h1>
            <p className="text-xs text-muted-foreground">
              {words} words · {readingTimeMinutes(words)} min read ·{" "}
              {save.isPending ? (
                <span className="text-primary">saving…</span>
              ) : dirty ? (
                "unsaved"
              ) : (
                `saved ${relativeTime(draftQuery.data?.lastSavedAt)}`
              )}
            </p>
          </div>

          <Select
            value={idea.status}
            onValueChange={value =>
              updateIdea.mutate({ id: ideaId, status: value as IdeaStatus })
            }
          >
            <SelectTrigger className="hidden w-36 sm:flex" aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IDEA_STATUSES.map(status => (
                <SelectItem key={status} value={status}>
                  {status === "in-progress" ? "In progress" : status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={idea.status === "published" ? "outline" : "default"}
            size="sm"
            onClick={() => setShipping(true)}
          >
            <Send className="size-4" aria-hidden />
            <span className="sr-only md:not-sr-only md:ml-2">
              {idea.status === "published" ? "Shipped" : "Ship it"}
            </span>
          </Button>

          <Button variant="outline" size="sm" onClick={exportMarkdown}>
            <Download className="size-4" aria-hidden />
            <span className="sr-only">Export as Markdown</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => save.mutate({ ideaId, content })}
            disabled={save.isPending || !dirty}
          >
            {save.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Check className="size-4" aria-hidden />
            )}
            <span className="sr-only">{dirty ? "Save" : "Saved"}</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRailOpen(open => !open)}
            aria-label={railOpen ? "Hide raw material" : "Show raw material"}
            aria-pressed={railOpen}
          >
            {railOpen ? (
              <PanelRightClose className="size-4" aria-hidden />
            ) : (
              <PanelRightOpen className="size-4" aria-hidden />
            )}
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col lg:flex-row">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={event => {
            setContent(event.target.value);
            setDirty(true);
          }}
          placeholder="Start writing. It doesn't have to be good yet."
          aria-label={`Draft of ${idea.title}`}
          className={cn(
            "w-full flex-1 resize-none bg-transparent px-6 py-10 text-lg leading-relaxed focus:outline-none",
            !railOpen && "mx-auto max-w-3xl"
          )}
          style={{ fontFamily: "'Crimson Text', Georgia, serif" }}
        />

        {railOpen && <ThoughtRail ideaId={ideaId} onInsert={insertText} />}
      </div>

      <ShipDialog
        idea={idea}
        open={shipping}
        onClose={() => setShipping(false)}
      />
    </div>
  );
}
