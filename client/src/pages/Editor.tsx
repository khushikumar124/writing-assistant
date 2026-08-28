import EditorToolbar, { type Format } from "@/components/EditorToolbar";
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
import {
  continueList,
  insertLink,
  renderMarkdown,
  togglePrefix,
  toggleWrap,
  toPlainText,
  type Edit,
  type Selection,
} from "@/lib/markdown";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { IDEA_STATUSES, type IdeaStatus } from "@shared/types";
import {
  ChevronLeft,
  ClipboardCopy,
  Download,
  Eye,
  Loader2,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  PenLine,
  Send,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useParams } from "wouter";

const AUTOSAVE_DELAY_MS = 1200;

/**
 * The writing surface.
 *
 * The guiding constraint is that this screen should never make someone feel
 * behind. It reports what they have done — words written in this sitting,
 * progress towards a goal they chose — and never what they have failed to do.
 * There is no streak here, no "you haven't written in N days", no red unsaved
 * warning. Those belong on the dashboard, if anywhere.
 */
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
  const { data: preferences } = trpc.categories.getPreferences.useQuery();

  const [content, setContent] = useState("");
  /** Content as last confirmed saved, so we never autosave a no-op. */
  const savedContent = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [focusMode, setFocusMode] = useState(false);
  const [preview, setPreview] = useState(false);
  const [shipping, setShipping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** Words in the document when this sitting began, for "written just now". */
  const openedWith = useRef<number | null>(null);

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
      openedWith.current = countWords(draftQuery.data.content);
    } else if (
      draftQuery.isSuccess &&
      !draftQuery.data &&
      savedContent.current === null
    ) {
      savedContent.current = "";
      openedWith.current = 0;
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
  const writtenThisSitting = Math.max(0, words - (openedWith.current ?? words));
  const goal = preferences?.dailyWordGoal ?? 0;

  /** Applies an edit and restores the selection the transform asked for. */
  const applyEdit = useCallback((edit: Edit) => {
    setContent(edit.text);
    setDirty(true);
    requestAnimationFrame(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(edit.selection.start, edit.selection.end);
    });
  }, []);

  const currentSelection = (): Selection => {
    const textarea = textareaRef.current;
    return {
      start: textarea?.selectionStart ?? content.length,
      end: textarea?.selectionEnd ?? content.length,
    };
  };

  const format = useCallback(
    (which: Format) => {
      const selection = currentSelection();
      switch (which) {
        case "bold":
          return applyEdit(toggleWrap(content, selection, "**"));
        case "italic":
          return applyEdit(toggleWrap(content, selection, "_"));
        case "h1":
          return applyEdit(togglePrefix(content, selection, "# "));
        case "h2":
          return applyEdit(togglePrefix(content, selection, "## "));
        case "quote":
          return applyEdit(togglePrefix(content, selection, "> "));
        case "bullet":
          return applyEdit(togglePrefix(content, selection, "- "));
        case "numbered":
          return applyEdit(togglePrefix(content, selection, "1. "));
        case "link":
          return applyEdit(insertLink(content, selection));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [content, applyEdit]
  );

  /** Keyboard formatting, plus Enter continuing a list. */
  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const meta = event.metaKey || event.ctrlKey;

    if (meta && !event.shiftKey) {
      const map: Record<string, Format> = {
        b: "bold",
        i: "italic",
        k: "link",
        "1": "h1",
        "2": "h2",
      };
      const which = map[event.key.toLowerCase()];
      if (which) {
        event.preventDefault();
        format(which);
        return;
      }
      if (event.key.toLowerCase() === "s") {
        // Muscle memory deserves an answer even though saving is automatic.
        event.preventDefault();
        if (dirty) save.mutate({ ideaId, content });
        else toast("Already saved.");
        return;
      }
    }

    if (meta && event.shiftKey) {
      const map: Record<string, Format> = {
        ">": "quote",
        ".": "quote",
        "*": "bullet",
        "8": "bullet",
        "&": "numbered",
        "7": "numbered",
      };
      const which = map[event.key];
      if (which) {
        event.preventDefault();
        format(which);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey && !meta) {
      const edit = continueList(content, event.currentTarget.selectionStart);
      if (edit) {
        event.preventDefault();
        applyEdit(edit);
      }
    }

    if (event.key === "Escape" && focusMode) setFocusMode(false);
  };

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
    applyEdit({
      text:
        content.slice(0, selectionStart) + block + content.slice(selectionEnd),
      selection: {
        start: selectionStart + block.length,
        end: selectionStart + block.length,
      },
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

  /**
   * The last mile into Substack or Medium, neither of which has a write API.
   * Copies the piece as plain text with the markdown syntax resolved, so it can
   * be pasted straight into their editor.
   */
  const copyForPublishing = async () => {
    await navigator.clipboard.writeText(
      `${idea.title}\n\n${toPlainText(content)}`
    );
    toast.success("Copied. Paste it into Substack, Medium or an email.");
  };

  /** Quiet, never alarming: saving is the app's job, not the writer's. */
  const status = save.isPending
    ? "saving…"
    : dirty
      ? "unsaved changes"
      : `saved ${relativeTime(draftQuery.data?.lastSavedAt)}`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!focusMode && (
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
              <p className="typewriter text-muted-foreground">
                {words} words · {readingTimeMinutes(words)} min · {status}
              </p>
            </div>

            <Select
              value={idea.status}
              onValueChange={value =>
                updateIdea.mutate({ id: ideaId, status: value as IdeaStatus })
              }
            >
              <SelectTrigger
                className="hidden w-36 sm:flex"
                aria-label="Status"
              >
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

            <Button
              variant="ghost"
              size="sm"
              onClick={copyForPublishing}
              aria-label="Copy for pasting elsewhere"
            >
              <ClipboardCopy className="size-4" aria-hidden />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={exportMarkdown}
              aria-label="Export as Markdown"
            >
              <Download className="size-4" aria-hidden />
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPreview(value => !value)}
              aria-label={preview ? "Back to writing" : "Preview"}
              aria-pressed={preview}
            >
              {preview ? (
                <PenLine className="size-4" aria-hidden />
              ) : (
                <Eye className="size-4" aria-hidden />
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setFocusMode(true)}
              aria-label="Focus mode"
            >
              <Maximize2 className="size-4" aria-hidden />
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

          {!preview && (
            <div className="mx-auto max-w-6xl pb-2">
              <EditorToolbar onFormat={format} />
            </div>
          )}
        </header>
      )}

      {focusMode && (
        <button
          onClick={() => setFocusMode(false)}
          className="fixed right-4 top-4 z-50 rounded-md p-2 text-muted-foreground opacity-40 transition-opacity hover:opacity-100"
          aria-label="Leave focus mode"
        >
          <Minimize2 className="size-4" aria-hidden />
        </button>
      )}

      <div
        className={cn(
          "mx-auto flex w-full flex-1 flex-col lg:flex-row",
          focusMode ? "max-w-3xl" : "max-w-6xl"
        )}
      >
        {preview ? (
          <article
            className="prose prose-lg mx-auto w-full max-w-3xl flex-1 px-6 py-10 dark:prose-invert"
            // Sanitised in renderMarkdown before it ever reaches here.
            dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
          />
        ) : (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={event => {
              setContent(event.target.value);
              setDirty(true);
            }}
            onKeyDown={onKeyDown}
            placeholder="Start anywhere. It doesn't have to be good, and it doesn't have to be finished."
            aria-label={`Draft of ${idea.title}`}
            spellCheck
            className={cn(
              "w-full flex-1 resize-none bg-transparent px-6 py-10 text-lg leading-relaxed focus:outline-none",
              (!railOpen || focusMode) && "mx-auto max-w-3xl"
            )}
            style={{ fontFamily: "'Crimson Text', Georgia, serif" }}
          />
        )}

        {railOpen && !focusMode && !preview && (
          <ThoughtRail ideaId={ideaId} onInsert={insertText} />
        )}
      </div>

      {/* A quiet footer that only ever reports progress, never a deficit. */}
      <footer
        className={cn(
          "sticky bottom-0 border-t border-border bg-background/85 px-6 py-2 backdrop-blur-sm",
          focusMode && "border-transparent bg-transparent"
        )}
      >
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1">
          {writtenThisSitting > 0 && (
            <span className="typewriter text-primary">
              +{writtenThisSitting} words this sitting
            </span>
          )}

          {goal > 0 && (
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary transition-all duration-500"
                  style={{
                    width: `${Math.min(100, (writtenThisSitting / goal) * 100)}%`,
                  }}
                />
              </span>
              <span className="typewriter text-muted-foreground">
                {writtenThisSitting >= goal
                  ? "goal met — keep going if you like"
                  : `${goal} word goal`}
              </span>
            </span>
          )}

          <span className="typewriter ml-auto text-muted-foreground">
            {status}
          </span>
        </div>
      </footer>

      <ShipDialog
        idea={idea}
        open={shipping}
        onClose={() => setShipping(false)}
      />
    </div>
  );
}
