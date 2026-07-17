"use client";

import { useCallback, useEffect, useRef } from "react";

import { useMapsStore } from "../store";

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
 * Real browser Fullscreen API on a caller-attached element, plus the
 * gated `F` keyboard shortcut - ported from `old/TarkovTrackerWB-main/src/
 * components/maps/fullscreen.js`'s `toggleMapFullscreen`/`_onMapFullscreenChange`
 * and its `keydown` handler. State is synced from the browser's own
 * `fullscreenchange` event (fired on Esc-exit too, not just the button),
 * not flipped optimistically on click - `isFullscreen` always reflects
 * reality. **Simplification, documented**: legacy also gates the shortcut
 * on "not in draw mode" - dropped here since `F` isn't used by any of this
 * app's draw-mode shortcuts (`use-draw-tool.ts`'s Escape/Ctrl+Z/Shift/Ctrl),
 * so there's no actual conflict to guard against.
 */
export function useFullscreen(): UseFullscreenResult {
  const ref = useRef<HTMLDivElement | null>(null);
  const isFullscreen = useMapsStore((state) => state.mapFullscreen);
  const setMapFullscreen = useMapsStore((state) => state.setMapFullscreen);

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
      setMapFullscreen(document.fullscreenElement === ref.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [setMapFullscreen]);

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
