import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

/**
 * Bringing existing notes in.
 *
 * The biggest barrier to adopting this is that everyone already has a pile of
 * half-thoughts somewhere else — Obsidian, Bear, Apple Notes, a folder of text
 * files. Starting from an empty app means starting from nothing, and nobody
 * retypes three years of notes.
 *
 * Everything readable is Markdown or plain text, so the import is deliberately
 * format-agnostic: it takes files, not an export bundle from one specific app.
 * Short files become thoughts, longer ones become ideas with their prose
 * intact, because a two-line note and a finished essay are different objects
 * here and importing them identically would be wrong.
 */

/** Above this, a file is a piece of writing rather than a note. */
const IDEA_WORD_THRESHOLD = 120;

type Parsed = {
  title: string;
  body: string;
  words: number;
};

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

/**
 * Pulls a title out of a file: front matter, then a leading `# heading`, then
 * the filename. Obsidian and Bear both lead with a heading; Apple Notes exports
 * use the first line.
 */
export function parseNote(filename: string, raw: string): Parsed {
  let text = raw.replace(/\r\n/g, "\n").trim();
  let title = "";

  // YAML front matter, which Obsidian writes.
  const frontMatter = /^---\n([\s\S]*?)\n---\n?/.exec(text);
  if (frontMatter) {
    const titleLine = /^title:\s*(.+)$/m.exec(frontMatter[1]);
    if (titleLine) title = titleLine[1].trim().replace(/^["']|["']$/g, "");
    text = text.slice(frontMatter[0].length).trim();
  }

  if (!title) {
    const heading = /^#{1,3}\s+(.+)$/m.exec(text.split("\n")[0] ?? "");
    if (heading) {
      title = heading[1].trim();
      text = text.split("\n").slice(1).join("\n").trim();
    }
  }

  if (!title) {
    title = filename
      .replace(/\.(md|markdown|txt|text)$/i, "")
      .replace(/[-_]/g, " ");
  }

  return { title: title.slice(0, 200), body: text, words: countWords(text) };
}

export default function ImportNotes() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const utils = trpc.useUtils();
  const createThought = trpc.thoughts.create.useMutation();
  const createIdea = trpc.ideas.create.useMutation();
  const saveDraft = trpc.drafts.save.useMutation();
  const { data: categories = [] } = trpc.categories.list.useQuery();

  const handleFiles = async (files: FileList) => {
    setBusy(true);
    const category = categories[0]?.name ?? "Imported";

    let thoughts = 0;
    let ideas = 0;
    let skipped = 0;

    try {
      for (const file of Array.from(files)) {
        const raw = await file.text();
        const note = parseNote(file.name, raw);

        // An empty file is not writing; importing it would just be litter.
        if (note.words === 0) {
          skipped += 1;
          continue;
        }

        if (note.words < IDEA_WORD_THRESHOLD) {
          // Short: it's a thought. Keep the title in the text so nothing is
          // lost, since thoughts have no title field.
          const content = note.body.startsWith(note.title)
            ? note.body
            : `${note.title}\n\n${note.body}`;
          await createThought.mutateAsync({
            content: content.slice(0, 5000),
            tags: ["imported"],
          });
          thoughts += 1;
        } else {
          const idea = await createIdea.mutateAsync({
            title: note.title,
            category,
          });
          await saveDraft.mutateAsync({ ideaId: idea.id, content: note.body });
          ideas += 1;
        }
      }

      await utils.invalidate();

      const parts = [
        ideas > 0 ? `${ideas} idea${ideas === 1 ? "" : "s"}` : null,
        thoughts > 0 ? `${thoughts} thought${thoughts === 1 ? "" : "s"}` : null,
      ].filter(Boolean);

      toast.success(
        parts.length > 0
          ? `Imported ${parts.join(" and ")}.`
          : "Nothing to import.",
        skipped > 0
          ? {
              description: `${skipped} empty file${skipped === 1 ? "" : "s"} skipped.`,
            }
          : undefined
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Import failed part way through."
      );
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="text-xl">Bring your notes in</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Markdown or text files from Obsidian, Bear, Apple Notes, or anywhere
          else. Short ones land in your thoughts; longer ones become ideas with
          the writing kept.
        </p>
      </div>

      <input
        ref={input}
        type="file"
        multiple
        accept=".md,.markdown,.txt,.text,text/markdown,text/plain"
        className="hidden"
        onChange={event => {
          if (event.target.files?.length) void handleFiles(event.target.files);
        }}
      />

      <Button
        variant="outline"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? (
          <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
        ) : (
          <Upload className="mr-2 size-4" aria-hidden />
        )}
        {busy ? "Importing…" : "Choose files"}
      </Button>

      <p className="text-xs text-muted-foreground">
        Everything is tagged <span className="typewriter">imported</span> so you
        can find it, and nothing already here is touched.
      </p>
    </Card>
  );
}
