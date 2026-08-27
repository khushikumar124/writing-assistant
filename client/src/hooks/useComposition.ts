import { useCallback, useRef } from "react";
import type { CompositionEvent, KeyboardEvent } from "react";

type CompositionHandlers<T extends HTMLElement> = {
  onKeyDown?: (event: KeyboardEvent<T>) => void;
  onCompositionStart?: (event: CompositionEvent<T>) => void;
  onCompositionEnd?: (event: CompositionEvent<T>) => void;
};

/**
 * Input-method editor (IME) support for CJK and other composed scripts.
 *
 * While composing, a keystroke like Enter belongs to the IME — it confirms the
 * candidate — and must not reach the component's own key handling, or typing
 * "日本語" into a form would submit it three times. This hook tracks the
 * composition window and swallows Enter for its duration.
 */
export function useComposition<T extends HTMLElement>(
  handlers: CompositionHandlers<T> = {}
) {
  const isComposing = useRef(false);

  const onCompositionStart = useCallback(
    (event: CompositionEvent<T>) => {
      isComposing.current = true;
      handlers.onCompositionStart?.(event);
    },
    [handlers]
  );

  const onCompositionEnd = useCallback(
    (event: CompositionEvent<T>) => {
      isComposing.current = false;
      handlers.onCompositionEnd?.(event);
    },
    [handlers]
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<T>) => {
      // `nativeEvent.isComposing` is the standard signal; the ref covers
      // browsers that fire keydown after compositionend but before the flag
      // clears.
      if (
        event.key === "Enter" &&
        (event.nativeEvent.isComposing || isComposing.current)
      ) {
        return;
      }
      handlers.onKeyDown?.(event);
    },
    [handlers]
  );

  return { onCompositionStart, onCompositionEnd, onKeyDown, isComposing };
}
