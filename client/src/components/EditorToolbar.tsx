import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Bold,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
} from "lucide-react";

/**
 * Formatting controls.
 *
 * Every one of these has a keyboard shortcut, and the shortcut is the intended
 * path — the buttons exist because a writer who has never used markdown should
 * not have to know the syntax before they can make a heading. The tooltips
 * teach the shortcut, so the toolbar makes itself redundant over time.
 */

export type Format =
  "bold" | "italic" | "h1" | "h2" | "quote" | "bullet" | "numbered" | "link";

const ACTIONS: {
  format: Format;
  icon: typeof Bold;
  label: string;
  shortcut: string;
}[] = [
  { format: "bold", icon: Bold, label: "Bold", shortcut: "⌘B" },
  { format: "italic", icon: Italic, label: "Italic", shortcut: "⌘I" },
  { format: "h1", icon: Heading1, label: "Heading", shortcut: "⌘1" },
  { format: "h2", icon: Heading2, label: "Subheading", shortcut: "⌘2" },
  { format: "quote", icon: Quote, label: "Quote", shortcut: "⌘⇧." },
  { format: "bullet", icon: List, label: "Bullet list", shortcut: "⌘⇧8" },
  {
    format: "numbered",
    icon: ListOrdered,
    label: "Numbered list",
    shortcut: "⌘⇧7",
  },
  { format: "link", icon: Link2, label: "Link", shortcut: "⌘K" },
];

export default function EditorToolbar({
  onFormat,
}: {
  onFormat: (format: Format) => void;
}) {
  return (
    <div
      className="flex flex-wrap items-center gap-0.5"
      role="toolbar"
      aria-label="Formatting"
    >
      {ACTIONS.map(({ format, icon: Icon, label, shortcut }) => (
        <Tooltip key={format}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="size-8 p-0"
              aria-label={`${label} (${shortcut})`}
              // The editor keeps focus, so the shortcut and the button end up
              // acting on the same selection rather than the button stealing it.
              onMouseDown={event => event.preventDefault()}
              onClick={() => onFormat(format)}
            >
              <Icon className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {label} <span className="text-muted-foreground">{shortcut}</span>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
