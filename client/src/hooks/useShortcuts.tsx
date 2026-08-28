import { useEffect, useState } from "react";
import { useLocation } from "wouter";

/**
 * App-wide keyboard shortcuts.
 *
 * Two styles, both borrowed from tools writers already use: modifier chords for
 * actions (⌘K to capture), and Gmail-style `g` sequences for navigation. The
 * sequences matter more than they look — once someone knows `g t`, moving
 * around stops costing a mouse trip, which is the difference between a tool you
 * dip into and one you live in.
 *
 * Everything is suppressed while typing, because a shortcut that fires inside
 * the editor would eat the writer's keystroke, which is unforgivable here.
 */

const GO_TO: Record<string, string> = {
  d: "/",
  t: "/thoughts",
  i: "/ideas",
  s: "/shipped",
  f: "/search",
  p: "/discover",
};

export const SHORTCUTS: { keys: string; does: string }[] = [
  { keys: "⌘K", does: "Capture a thought" },
  { keys: "/", does: "Search" },
  { keys: "g then d", does: "Dashboard" },
  { keys: "g then t", does: "Thoughts" },
  { keys: "g then i", does: "Ideas" },
  { keys: "g then s", does: "Shipped" },
  { keys: "g then p", does: "Discover prompts" },
  { keys: "?", does: "This list" },
  { keys: "Esc", does: "Close what's open" },
];

/** True when focus is somewhere a keystroke means text, not a command. */
function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tag = element.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    element.isContentEditable
  );
}

export function useShortcuts() {
  const [, navigate] = useLocation();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    // `g` arms a navigation sequence; anything other than a known destination
    // within a moment cancels it.
    let awaitingGo = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const disarm = () => {
      awaitingGo = false;
      if (timer) clearTimeout(timer);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (awaitingGo) {
        const destination = GO_TO[event.key.toLowerCase()];
        disarm();
        if (destination) {
          event.preventDefault();
          navigate(destination);
        }
        return;
      }

      if (event.key === "g") {
        awaitingGo = true;
        timer = setTimeout(disarm, 1200);
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        navigate("/search");
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(open => !open);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      disarm();
    };
  }, [navigate]);

  return { helpOpen, setHelpOpen };
}
