"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { RefObject } from "react";

export interface UseFullscreenResult {
  /** Attach to the element that should fill the screen in fullscreen mode. */
  ref: RefObject<HTMLDivElement | null>;
  isFullscreen: boolean;
  toggle: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select";
}

/**
 * Real browser Fullscreen API on a caller-attached element, plus a gated
 * `F` keyboard shortcut, ported from `old/TarkovTrackerWB-main/src/
 * components/maps/fullscreen.js`'s `toggleMapFullscreen`/`_onMapFullscreenChange`.
 * State is synced from the browser's own `fullscreenchange` event (fired on
 * Esc-exit too, not just the button), not flipped optimistically on click,
 * so `isFullscreen` always reflects reality.
 *
 * Originally lived only in `features/maps/hooks/` (backed by that feature's
 * own `useMapsStore` for `isFullscreen`), promoted here once the Progress
 * Tracker's quest-tree view needed the same behavior. `isFullscreen` is
 * plain local `useState` now instead of a shared store field so each
 * caller gets its own independent instance (the old `mapFullscreen` store
 * field had no reader besides this hook itself).
 */
export function useFullscreen(): UseFullscreenResult {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void el.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    function onFullscreenChange(): void {
      setIsFullscreen(document.fullscreenElement === ref.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (isTypingTarget(event.target)) return;
      if (event.key.toLowerCase() !== "f") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      toggle();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [toggle]);

  return { ref, isFullscreen, toggle };
}
