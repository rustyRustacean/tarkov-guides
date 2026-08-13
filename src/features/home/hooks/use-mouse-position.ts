"use client";

import { useEffect, useState } from "react";

interface MousePosition {
  x: number;
  y: number;
}

/**
 * Tracks the viewport-relative mouse position via a `mousemove` listener.
 * Defaults to the screen center before the first move event fires. Plain
 * `useState`+`useEffect` (not `useSyncExternalStore`, unlike `ThemeProvider`)
 * is fine here: the initial value has no SSR-correctness stake (the
 * consumer, `RiverHero`, is `pointer-events-none` decoration, not something
 * whose default position causes a visible layout jump).
 */
export function useMousePosition(): MousePosition {
  const [position, setPosition] = useState<MousePosition>(() => ({
    x: typeof window === "undefined" ? 0 : window.innerWidth / 2,
    y: typeof window === "undefined" ? 0 : window.innerHeight / 2,
  }));

  useEffect(() => {
    function handleMouseMove(event: MouseEvent): void {
      setPosition({ x: event.clientX, y: event.clientY });
    }

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  return position;
}
