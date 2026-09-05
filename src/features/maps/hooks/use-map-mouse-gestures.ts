"use client";

import { useEffect, useRef } from "react";

import type L from "leaflet";

interface UseMapMouseGesturesOptions {
  map: L.Map;
  /**
   * Middle-click toggles draw mode - legacy's own standard gesture (its
   * hotkey editor, `drawHotkeys.js`, shipped `mouse:middle` bound to
   * toggle-draw by default). `null` when drawing has nowhere to be saved
   * (no profile and no session), in which case a middle-click still gets
   * its browser default suppressed but does nothing else.
   */
  onToggleDrawMode: (() => void) | null;
}

/**
 * The two mouse gestures Leaflet doesn't give us: **middle-click toggles
 * draw mode**, and **right-click-drag pans**, the latter at all times -
 * including while draw mode has taken the left button (and therefore
 * Leaflet's own `dragging` handler) away from panning. Without it, turning
 * drawing on meant losing the ability to move the map without turning
 * drawing back off first.
 *
 * Panning is done by hand via `panBy` rather than by re-enabling Leaflet's
 * `dragging`: that handler is hardwired to the left button (its underlying
 * `Draggable` ignores anything else), so there is nothing to configure - the
 * right-button drag has to be tracked directly. `mousemove`/`mouseup` are
 * bound on `window`, not the container, so a drag that leaves the map (or
 * ends over the toolbar overlay) still tracks and still terminates.
 */
export function useMapMouseGestures({ map, onToggleDrawMode }: UseMapMouseGesturesOptions): void {
  // `onToggleDrawMode` is a fresh closure every render. Reading it through a
  // ref keeps the effect below on `[map]` alone - re-subscribing native
  // listeners on every render is exactly the failure `AnnotationCanvas`
  // documents at length for `useMapEvents` (events silently going missing
  // mid-drag), and this hook's listeners run alongside those.
  const latestToggle = useRef(onToggleDrawMode);
  useEffect(() => {
    latestToggle.current = onToggleDrawMode;
  });

  useEffect(() => {
    const container = map.getContainer();
    let lastPanPoint: { x: number; y: number } | null = null;

    function handleMouseMove(event: MouseEvent): void {
      if (!lastPanPoint) return;
      const dx = event.clientX - lastPanPoint.x;
      const dy = event.clientY - lastPanPoint.y;
      lastPanPoint = { x: event.clientX, y: event.clientY };
      // Inverted: dragging the map right moves the *view* left.
      map.panBy([-dx, -dy], { animate: false });
    }

    function endPan(): void {
      if (!lastPanPoint) return;
      lastPanPoint = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", endPan);
    }

    function handleMouseDown(event: MouseEvent): void {
      // Middle button: suppress Chromium's autoscroll, which otherwise
      // captures the pointer under a scroll-cursor puck and swallows the
      // `auxclick` this gesture is built on.
      if (event.button === 1) {
        event.preventDefault();
        return;
      }
      if (event.button !== 2) return;
      event.preventDefault();
      lastPanPoint = { x: event.clientX, y: event.clientY };
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", endPan);
    }

    function handleAuxClick(event: MouseEvent): void {
      if (event.button !== 1) return;
      event.preventDefault();
      latestToggle.current?.();
    }

    /** Right-drag is a pan here, so the browser menu that would pop up at the end of it is never wanted. */
    function handleContextMenu(event: MouseEvent): void {
      event.preventDefault();
    }

    container.addEventListener("mousedown", handleMouseDown);
    container.addEventListener("auxclick", handleAuxClick);
    container.addEventListener("contextmenu", handleContextMenu);
    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      container.removeEventListener("auxclick", handleAuxClick);
      container.removeEventListener("contextmenu", handleContextMenu);
      endPan();
    };
  }, [map]);
}
