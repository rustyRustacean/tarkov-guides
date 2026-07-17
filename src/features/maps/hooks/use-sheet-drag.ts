"use client";

import { useEffect, useRef, useState } from "react";

import { clampSheetHeight, computeSnapDecision, restingHeightPx } from "../lib/sheet-drag";

export interface UseSheetDragOptions {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface UseSheetDragResult {
  /** Attach to the grab-handle element - drags/taps on it drive the sheet. */
  handleRef: (node: HTMLButtonElement | null) => void;
  /** Attach to the grid container whose rows get live-resized during a drag. */
  containerRef: (node: HTMLDivElement | null) => void;
}

interface DragState {
  dragging: boolean;
  startY: number;
  startBottomPx: number;
  lastY: number;
  lastT: number;
  velocityPxPerMs: number;
  movedPx: number;
  containerHeightPx: number;
}

function applyHeight(container: HTMLDivElement, bottomPx: number): void {
  const topPx = container.getBoundingClientRect().height - bottomPx;
  container.style.gridTemplateRows = `${String(topPx)}px ${String(bottomPx)}px`;
}

/**
 * Drag-to-open/close wiring for the mobile bottom sheet - ported from
 * `old/TarkovTrackerWB-main/src/components/layout/routing.js`'s
 * `_initSheetDrag`. The actual tap/flick/height-fraction decision is the
 * pure, separately-tested `computeSnapDecision` (`lib/sheet-drag.ts`) - this
 * hook is purely event wiring: live-resizes the container by direct DOM
 * mutation during the drag (`transition: none`, 1:1 pointer follow, no
 * React re-render in the loop - there's no visual state to mirror into
 * `useState` here, unlike `AnnotationCanvas`'s dual-ref-then-state pattern,
 * since nothing about the live-follow needs to trigger a re-render), then
 * commits the snap decision once on release.
 *
 * Uses callback refs backed by `useState`, not plain `useRef` objects - a
 * real bug found via this feature's mandatory real-browser verification
 * pass (Phase 5 step 13), not caught by any unit test. `MapScreenLayout`
 * only renders the mobile branch (and thus this hook's handle/container
 * elements) after `useIsMobileViewport`'s SSR-safe `false`-then-real-value
 * hydration flip (see that hook's own doc comment) - on a real page load,
 * the first commit is always the desktop branch, so a mount-only
 * `useEffect(..., [])` reading `ref.current` attaches against `null` and
 * never retries once the mobile branch mounts on the very next render.
 * Component/unit tests never exercised this because RTL's `render()` isn't
 * a real hydration pass - `useSyncExternalStore` calls `getSnapshot()`
 * (not `getServerSnapshot()`) on a plain client render, so a mocked mobile
 * viewport is already `true` on the first render and the bug never
 * surfaces. Callback refs turn "the node changed" into real state, so the
 * listener-attaching effect can depend on it and correctly re-run once the
 * mobile branch actually mounts.
 */
export function useSheetDrag({ isOpen, onOpenChange }: UseSheetDragOptions): UseSheetDragResult {
  const [handle, setHandle] = useState<HTMLButtonElement | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const isOpenRef = useRef(isOpen);
  const onOpenChangeRef = useRef(onOpenChange);
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  // Keeps the imperative height in sync with `isOpen` when it changes from
  // OUTSIDE this hook (e.g. a separate programmatic toggle) - skipped while
  // a drag is actively live-resizing the container itself.
  useEffect(() => {
    if (!container || dragRef.current?.dragging) return;
    const height = container.getBoundingClientRect().height;
    applyHeight(container, restingHeightPx(isOpen, height));
  }, [isOpen, container]);

  useEffect(() => {
    if (!handle || !container) return;

    const onPointerDown = (event: PointerEvent): void => {
      const containerHeightPx = container.getBoundingClientRect().height;
      dragRef.current = {
        dragging: true,
        startY: event.clientY,
        startBottomPx: restingHeightPx(isOpenRef.current, containerHeightPx),
        lastY: event.clientY,
        lastT: performance.now(),
        velocityPxPerMs: 0,
        movedPx: 0,
        containerHeightPx,
      };
      container.style.transition = "none";
      handle.setPointerCapture(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag?.dragging) return;
      const dy = event.clientY - drag.startY;
      drag.movedPx = Math.max(drag.movedPx, Math.abs(dy));
      const now = performance.now();
      drag.velocityPxPerMs = (event.clientY - drag.lastY) / Math.max(1, now - drag.lastT);
      drag.lastY = event.clientY;
      drag.lastT = now;
      applyHeight(container, clampSheetHeight(drag.startBottomPx - dy, drag.containerHeightPx));
      event.preventDefault();
    };

    const onPointerEnd = (event: PointerEvent): void => {
      const drag = dragRef.current;
      if (!drag?.dragging) return;
      drag.dragging = false;
      handle.releasePointerCapture(event.pointerId);

      const currentBottomPx = clampSheetHeight(
        drag.startBottomPx - (drag.lastY - drag.startY),
        drag.containerHeightPx,
      );
      const open = computeSnapDecision({
        movedPx: drag.movedPx,
        velocityPxPerMs: drag.velocityPxPerMs,
        currentBottomPx,
        containerHeightPx: drag.containerHeightPx,
        currentlyOpen: isOpenRef.current,
      });

      container.style.transition = "";
      applyHeight(container, restingHeightPx(open, drag.containerHeightPx));
      onOpenChangeRef.current(open);
    };

    handle.addEventListener("pointerdown", onPointerDown);
    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerEnd);
    handle.addEventListener("pointercancel", onPointerEnd);
    return () => {
      handle.removeEventListener("pointerdown", onPointerDown);
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", onPointerEnd);
      handle.removeEventListener("pointercancel", onPointerEnd);
    };
  }, [handle, container]);

  return { handleRef: setHandle, containerRef: setContainer };
}
