"use client";

import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { Suspense, useEffect, useRef } from "react";

import { GameDataGate } from "@/shared/lib/tarkov-api/GameDataGate";
import { useFullscreen } from "@/shared/lib/use-fullscreen";
import { Button } from "@/shared/ui/button/Button";

import { useAutoCollapseEmptyLeftPanel } from "../hooks/use-auto-collapse-empty-left-panel";
import { useIsMobileViewport } from "../hooks/use-is-mobile-viewport";
import { useSheetDrag } from "../hooks/use-sheet-drag";
import { useMapsStore } from "../store";

import { MapSidebar } from "./MapSidebar";
import { MapVariantSwitcher } from "./MapVariantSwitcher";
import { MapViewerLazy } from "./MapViewerLazy";
import { SessionControls } from "./session/SessionControls";

interface Props {
  normalizedName: string;
}

/**
 * The map screen's composed layout: `MapViewer` and the `MapSidebar`
 * (Items / Tasks / Flea Market tabs), in a two-column grid - the collapsible
 * sidebar on the left, the viewport column on the right. (The boss roster
 * lives up in the map-picker row now - see `MapBossStrips`/`MapsPage.tsx` -
 * not in this column.) Chrome behaviors: real Fullscreen API on the header+viewport column
 * (`fullscreen.js`), and - below the mobile breakpoint - `MapSidebar` becomes
 * a drag-to-open bottom sheet (`routing.js`'s `_initSheetDrag`). Renders
 * `MapViewerLazy`, not `MapViewer` directly - Leaflet touches `window` at
 * module load time (see `MapViewerLazy.tsx`'s own doc comment).
 *
 * `GameDataGate` wraps only `MapSidebar` here (2026-07-28 tarkov.dev-outage
 * audit), not this whole layout - `MapViewer`'s imagery is bundled locally
 * (`public/maps/`) and every other panel here (e.g. `TaskMarkersLayer`)
 * already degrades to an empty/hidden state on its own
 * when `useTarkovGameData()` has no data. Only `MapSidebar` renders "nothing
 * here" copy that would otherwise be indistinguishable from a genuinely-empty
 * result (the same H-2 ambiguity `GameDataGate` exists to fix), so it's what
 * actually needs the gate.
 */
export function MapScreenLayout({ normalizedName }: Props) {
  const isMobile = useIsMobileViewport();
  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const leftPanelCollapsed = useMapsStore((state) => state.leftPanelCollapsed);
  const setLeftPanelCollapsed = useMapsStore((state) => state.setLeftPanelCollapsed);

  // The one exception to "never auto-collapsed" below: a single one-shot
  // default, applied the first time it's known this map has nothing in its
  // sidebar (see the hook's own doc comment). After that it's back to
  // store-default-and-user-toggle-only for the rest of this mount.
  useAutoCollapseEmptyLeftPanel(normalizedName);

  // Otherwise the Items/Tasks panel follows only its store default and the
  // user's own toggle. Switching maps (map tabs, a task's "go to {map}"
  // jump) must not close it out from under the user.
  function toggleLeftPanel(): void {
    setLeftPanelCollapsed(!leftPanelCollapsed);
  }

  const mobileSheetOpen = useMapsStore((state) => state.mobileSheetOpen);
  const setMobileSheetOpen = useMapsStore((state) => state.setMobileSheetOpen);
  const { handleRef, containerRef } = useSheetDrag({
    isOpen: mobileSheetOpen,
    onOpenChange: setMobileSheetOpen,
  });

  // Leaflet's own `scrollWheelZoom` (on by default) already binds a
  // non-passive `wheel` listener to `.leaflet-container` itself and
  // prevents the default scroll - but the fullscreen/session-controls
  // button group and `MapVariantSwitcher` pill below are DOM siblings of
  // `MapViewerLazy`, only visually stacked on top via `absolute` +
  // `z-[1000]`, so Leaflet never sees a wheel event over those regions and
  // it bubbles up to scroll the page instead. A real (non-passive) native
  // listener on this wrapper closes that gap without touching Leaflet's
  // own zoom handling. Must be a real `addEventListener(..., {passive:
  // false})`, not a JSX `onWheel` prop - React's synthetic wheel handler
  // is passive by default, so `preventDefault()` there is a silent no-op.
  const mapAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = mapAreaRef.current;
    if (!node) return;
    const handleWheel = (event: WheelEvent): void => {
      event.preventDefault();
    };
    node.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", handleWheel);
    };
  }, []);

  const mapColumn = (
    <div ref={fullscreenRef} className="bg-background relative flex h-full min-h-0 flex-col">
      {/* `isolate` contains the map's z-index range (Leaflet's panes at
          200-700, plus the `z-[1000]` floating controls below) in its own
          stacking context. Without it, `position: relative` alone creates no
          stacking context, so those values resolve at the page root and paint
          over portaled overlays (the `z-50` Dialog/Toast/Tooltip layer). */}
      <div ref={mapAreaRef} className="relative isolate min-h-0 flex-1">
        <MapViewerLazy normalizedName={normalizedName} />
        {/* Top-right controls row. `AnnotationToolbar`'s "Draw" toolbar (inside
            `AnnotationCanvas`, itself inside `MapViewerLazy`) sits just below
            this row (`top-16 right-3`), off the left edge the floating sidebar
            now overlays. */}
        <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
          <Suspense fallback={null}>
            <SessionControls />
          </Suspense>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen map (F)"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen map (F)"}
            className="bg-background/90 shadow-sm backdrop-blur-sm"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
        <div className="absolute top-3 left-1/2 z-[1000] max-w-[calc(100%-14rem)] -translate-x-1/2">
          <MapVariantSwitcher normalizedName={normalizedName} />
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div
        ref={containerRef}
        className="grid h-full grid-rows-[1fr_46px] transition-[grid-template-rows] duration-200"
      >
        <div className="min-h-0">{mapColumn}</div>
        <div className="border-border bg-muted flex min-h-0 flex-col overflow-hidden border-t">
          <button
            ref={handleRef}
            type="button"
            className="flex shrink-0 touch-none items-center justify-center gap-2 py-2"
          >
            <span className="bg-muted-foreground/50 h-1 w-10 rounded-full" aria-hidden="true" />
            <span className="sr-only">Toggle Items &amp; Tasks panel - tap or drag</span>
          </button>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <GameDataGate>
              <MapSidebar normalizedName={normalizedName} />
            </GameDataGate>
          </div>
        </div>
      </div>
    );
  }

  // The map fills the whole area; the Items/Tasks/Flea sidebar floats on top
  // of it as a transparent, click-through column, so its individual entries
  // read as cards floating over the still-visible map rather than a solid
  // panel that cuts the map off. The wrapper is `pointer-events-none` so map
  // pan/zoom works in the gaps between entries; the toggle and the scroll
  // column re-enable pointer events for themselves.
  return (
    <div className="relative h-full">
      {mapColumn}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex min-h-0 flex-col items-start gap-2 p-2">
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={toggleLeftPanel}
          aria-label={
            leftPanelCollapsed ? "Expand items & tasks panel" : "Collapse items & tasks panel"
          }
          title={leftPanelCollapsed ? "Expand items & tasks panel" : "Collapse items & tasks panel"}
          className="bg-background/90 pointer-events-auto shrink-0 shadow-sm backdrop-blur-sm"
        >
          {leftPanelCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
        {!leftPanelCollapsed && (
          // A near-invisible "glass" backing for the whole column (~5% opaque
          // over the map, plus a slight backdrop-blur and a hairline edge) so
          // the column reads as one soft pane you barely register - the cards
          // inside it (bg-popover) still carry the visible weight.
          <div className="border-border/20 bg-card/5 pointer-events-auto min-h-0 w-80 flex-1 scrollbar-none overflow-y-auto rounded-lg border backdrop-blur-[2px]">
            <GameDataGate>
              <MapSidebar normalizedName={normalizedName} />
            </GameDataGate>
          </div>
        )}
      </div>
    </div>
  );
}
