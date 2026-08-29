import DOMPurify from "dompurify";
import { marked } from "marked";

/**
 * Markdown, and the text transforms behind the editor's formatting shortcuts.
 *
 * The editor stays a plain `<textarea>` holding plain markdown rather than
 * becoming a rich-text surface. That is a deliberate choice: a contenteditable
 * WYSIWYG brings its own selection bugs, paste handling and undo stack, and it
 * would put a layer between the writer and their words. Markdown in a textarea
 * keeps the browser's own undo, works with every assistive technology, and the
 * file you export is exactly what you typed.
 */

marked.setOptions({ gfm: true, breaks: true });

/** Renders markdown for the preview pane, sanitised before it reaches the DOM. */
export function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false });
  // The content is the reader's own, so this is guarding them against their own
  // paste rather than against an attacker — but a draft can easily contain
  // markup copied from somewhere else, and rendering that unfiltered would be
  // careless.
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

export type Selection = { start: number; end: number };
export type Edit = { text: string; selection: Selection };

/**
 * Wraps the selection in `marker`, or unwraps it if it is already wrapped.
 * With nothing selected, inserts the pair and puts the caret between them, so
 * ⌘B then typing behaves the way it does in every other editor.
 */
export function toggleWrap(
  text: string,
  { start, end }: Selection,
  marker: string
): Edit {
  const selected = text.slice(start, end);
  const before = text.slice(0, start);
  const after = text.slice(end);

  const alreadyWrapped =
    before.endsWith(marker) && after.startsWith(marker) && start !== end;

  if (alreadyWrapped) {
    return {
      text:
        before.slice(0, -marker.length) + selected + after.slice(marker.length),
      selection: {
        start: start - marker.length,
        end: end - marker.length,
      },
    };
  }

  if (selected.length === 0) {
    return {
      text: `${before}${marker}${marker}${after}`,
      selection: { start: start + marker.length, end: start + marker.length },
    };
  }

  return {
    text: `${before}${marker}${selected}${marker}${after}`,
    selection: {
      start: start + marker.length,
      end: end + marker.length,
    },
  };
}

/** The line boundaries containing the selection. */
function lineRange(text: string, { start, end }: Selection): Selection {
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineEndIndex = text.indexOf("\n", end);
  return {
    start: lineStart,
    end: lineEndIndex === -1 ? text.length : lineEndIndex,
  };
}

/**
 * Adds or removes a line prefix (`## `, `> `, `- `) across every selected line.
 * Toggling is per-block: if every line already has it, it comes off.
 */
export function togglePrefix(
  text: string,
  selection: Selection,
  prefix: string
): Edit {
  const block = lineRange(text, selection);
  const lines = text.slice(block.start, block.end).split("\n");

  // A heading replaces another heading rather than stacking, so ⌘2 after ⌘1
  // gives "## " and not "# ## ".
  const headingLike = /^#{1,6}\s+/;
  const isHeading = headingLike.test(prefix);

  const allPrefixed = lines.every(line => line.startsWith(prefix));
  const updated = lines
    .map(line => {
      if (allPrefixed) return line.slice(prefix.length);
      const bare = isHeading ? line.replace(headingLike, "") : line;
      return prefix + bare;
    })
    .join("\n");

  const replaced = text.slice(0, block.start) + updated + text.slice(block.end);
  const delta = updated.length - (block.end - block.start);

  return {
    text: replaced,
    selection: {
      start: selection.start,
      end: Math.max(selection.start, selection.end + delta),
    },
  };
}

/**
 * Turns a selection into a link. With text selected it becomes the label and
 * the caret lands in the URL slot, which is the order people actually work in.
 */
export function insertLink(text: string, { start, end }: Selection): Edit {
  const selected = text.slice(start, end) || "text";
  const snippet = `[${selected}](url)`;
  const replaced = text.slice(0, start) + snippet + text.slice(end);

  // Select the word "url" so typing replaces it.
  const urlStart = start + selected.length + 3;
  return {
    text: replaced,
    selection: { start: urlStart, end: urlStart + 3 },
  };
}

/**
 * Continues a list when Enter is pressed on a list line, and ends the list when
 * Enter is pressed on an empty item — the behaviour every editor has trained
 * people to expect, and its absence is felt immediately.
 */
export function continueList(text: string, caret: number): Edit | null {
  const lineStart = text.lastIndexOf("\n", caret - 1) + 1;
  const line = text.slice(lineStart, caret);

  const bullet = /^(\s*)([-*+])\s+(.*)$/.exec(line);
  const numbered = /^(\s*)(\d+)\.\s+(.*)$/.exec(line);
  const match = bullet ?? numbered;
  if (!match) return null;

  const [, indent, marker, content] = match;

  // Empty item: clear it instead of adding another, which is how you get out.
  if (content.trim().length === 0) {
    const replaced = text.slice(0, lineStart) + text.slice(caret);
    return { text: replaced, selection: { start: lineStart, end: lineStart } };
  }

  const next = numbered ? `${Number(marker) + 1}. ` : `${marker} `;
  const insertion = `\n${indent}${next}`;
  const replaced = text.slice(0, caret) + insertion + text.slice(caret);
  const position = caret + insertion.length;

  return { text: replaced, selection: { start: position, end: position } };
}

/**
 * Plain text for pasting into an editor that does not speak markdown — the last
 * mile into Substack, Medium or a mail client. Structure is preserved through
 * spacing rather than syntax, so headings read as headings instead of as `##`.
 */
export function toPlainText(source: string): string {
  return source
    .replace(/^#{1,6}\s+(.*)$/gm, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/(^|\W)\*(?!\s)(.+?)(?<!\s)\*/g, "$1$2")
    .replace(/(^|\W)_(?!\s)(.+?)(?<!\s)_/g, "$1$2")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/\[(.+?)\]\((.+?)\)/g, "$1 ($2)")
    .trim();
}

/**
 * Escapes text for interpolation into HTML.
 *
 * Used by the Word export, which builds a document by hand rather than going
 * through the sanitiser: a title containing `<` would otherwise open a tag in
 * the exported file.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
