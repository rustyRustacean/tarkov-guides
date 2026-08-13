import { useEffect, useRef } from "react";

export interface SingleOrDoubleClickHandlers {
  onClick: () => void;
  onDoubleClick: () => void;
}

/**
 * Disambiguates a single click from a double click on the same element so a
 * row can do two things: single-click opens the item-detail popup, while a
 * double-click keeps the existing pin/unpin shortcut. A browser fires
 * `click, click, dblclick` for a double click, so a naive `onClick` would
 * also fire on the way to a pin. This defers the single-click action by
 * `delayMs` (the usual double-click threshold) and cancels it if a
 * `dblclick` lands first. Returns handlers to spread onto the element.
 *
 * Keyboard Enter/Space activates `onClick` (details) as normal; the
 * double-click pin shortcut stays mouse-only, unchanged from the existing
 * behavior it preserves.
 */
export function useSingleOrDoubleClick(
  onSingle: () => void,
  onDouble: () => void,
  delayMs = 220,
): SingleOrDoubleClickHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep the latest callbacks without re-creating handlers each render.
  const singleRef = useRef(onSingle);
  const doubleRef = useRef(onDouble);

  // Sync the refs after each render, not during it: a render-phase ref write
  // is a React anti-pattern the linter flags.
  useEffect(() => {
    singleRef.current = onSingle;
    doubleRef.current = onDouble;
  });

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return {
    onClick: () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        singleRef.current();
      }, delayMs);
    },
    onDoubleClick: () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      doubleRef.current();
    },
  };
}
