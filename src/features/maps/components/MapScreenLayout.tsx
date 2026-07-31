"use client";

import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { Suspense, useEffect, useRef } from "react";

import { GameDataGate } from "@/shared/lib/tarkov-api/GameDataGate";
import { useFullscreen } from "@/shared/lib/use-fullscreen";
import { Button } from "@/shared/ui/button/Button";

import { useIsMobileViewport } from "../hooks/use-is-mobile-viewport";
import { useMapSidebarHasContent } from "../hooks/use-map-sidebar-has-content";
import { useSheetDrag } from "../hooks/use-sheet-drag";
import { useMapsStore } from "../store";

import { MapHeader } from "./MapHeader";
import { MapSidebar } from "./MapSidebar";
import { MapValuablesPanel } from "./MapValuablesPanel";
import { MapVariantSwitcher } from "./MapVariantSwitcher";
import { MapViewerLazy } from "./MapViewerLazy";
import { SessionControls } from "./session/SessionControls";

interface Props {
  normalizedName: string;
}

/**
 * The map screen's composed layout - the first place `MapHeader`,
 * `MapViewer`, `MapSidebar`, and `MapValuablesPanel` (steps 8-10) are
 * rendered together. Ported from `old/TarkovTrackerWB-main`'s `#map-layout`
 * 3-column grid, plus its chrome behaviors: real Fullscreen API on the
 * header+viewport column (`fullscreen.js`), the Valuables panel's collapse
 * (`sidebarFocus.js`'s `toggleRightPanel`), and - below the mobile
 * breakpoint - `MapSidebar` becomes a drag-to-open bottom sheet
 * (`routing.js`'s `_initSheetDrag`) while `MapValuablesPanel` is hidden
 * entirely, matching legacy's `#map-right{display:none}` at phone width
 * (see the Phase 5 step 11 plan for the full decision record). Renders
 * `MapViewerLazy`, not `MapViewer` directly - Leaflet touches `window` at
 * module load time (see `MapViewerLazy.tsx`'s own doc comment), and this
 * component is meant to be mounted into a real route eventually (step 13),
 * unlike `MapViewer`'s own test, which never goes through `next build`'s
 * SSR prerender pass. Not yet mounted into a route - `/maps` doesn't exist
 * yet, that's step 13.
 *
 * `GameDataGate` wraps only `MapSidebar`/`MapValuablesPanel` here (2026-07-28
 * tarkov.dev-outage audit), not this whole layout the way `MapsPage.tsx`
 * used to wrap it - `MapViewer`'s imagery is bundled locally
 * (`public/maps/`) and every other panel here (`MapHeader`,
 * `TaskMarkersLayer`) already degrades to an empty/hidden state on its own
 * when `useTarkovGameData()` has no data, so gating the entire page on that
 * query meant a visitor with zero prior cache (fresh browser, mid-outage)
 * saw a blocking error screen instead of the map, even though rendering the
 * map needs none of that data. Only `MapSidebar`/`MapValuablesPanel` render
 * "nothing here" copy that would otherwise be indistinguishable from a
 * genuinely-empty result (the same H-2 ambiguity `GameDataGate` itself
 * exists to fix - see its own doc comment) - those two are what actually
 * need the gate.
 */
export function MapScreenLayout({ normalizedName }: Props) {
  const isMobile = useIsMobileViewport();
  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const rightPanelCollapsed = useMapsStore((state) => state.rightPanelCollapsed);
  const setRightPanelCollapsed = useMapsStore((state) => state.setRightPanelCollapsed);

  const leftPanelCollapsed = useMapsStore((state) => state.leftPanelCollapsed);
  const setLeftPanelCollapsed = useMapsStore((state) => state.setLeftPanelCollapsed);

  // Defaults the Items/Tasks panel to collapsed when the selected map has
  // nothing to show there, so an empty sidebar doesn't eat width the map
  // viewer could use instead. Fires once per map (guarded by the ref, not
  // just the dependency array) so it never fights a manual toggle the user
  // makes while still looking at the same map - it only re-decides the
  // default when `normalizedName` actually changes. Waits for
  // `hasSidebarContent` to resolve past `undefined` (game data + profile
  // progress loaded) before locking in a map, otherwise a fresh page load
  // would default-collapse before real content had a chance to appear.
  const hasSidebarContent = useMapSidebarHasContent(normalizedName);
  const defaultedMapRef = useRef<string | null>(null);
  useEffect(() => {
    if (hasSidebarContent === undefined) return;
    if (defaultedMapRef.current === normalizedName) return;
    defaultedMapRef.current = normalizedName;
    setLeftPanelCollapsed(!hasSidebarContent);
  }, [normalizedName, hasSidebarContent, setLeftPanelCollapsed]);

  // A manual toggle also counts as "already defaulted" for this map - without
  // this, clicking the toggle while `hasSidebarContent` is still resolving
  // (e.g. game data hasn't loaded yet) would only be a temporary win: the
  // effect above fires the moment it resolves and, seeing this map not yet
  // marked, would overwrite the user's own click.
  function toggleLeftPanel(): void {
    defaultedMapRef.current = normalizedName;
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
      <MapHeader normalizedName={normalizedName} />
      <div ref={mapAreaRef} className="relative min-h-0 flex-1">
        <MapViewerLazy normalizedName={normalizedName} />
        {/* Left corner is `AnnotationToolbar`'s "Draw" toggle (rendered inside
            `AnnotationCanvas`, itself inside `MapViewerLazy`) - this row lives
            on the right instead so the two floating controls never collide. */}
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

  return (
    <div className="grid h-full grid-cols-[auto_minmax(0,1fr)_auto] gap-2">
      <div className="flex min-h-0 flex-col">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={toggleLeftPanel}
          aria-label={
            leftPanelCollapsed ? "Expand items & tasks panel" : "Collapse items & tasks panel"
          }
          title={leftPanelCollapsed ? "Expand items & tasks panel" : "Collapse items & tasks panel"}
        >
          {leftPanelCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
        {!leftPanelCollapsed && (
          <div className="min-h-0 w-80 overflow-y-auto">
            <GameDataGate>
              <MapSidebar normalizedName={normalizedName} />
            </GameDataGate>
          </div>
        )}
      </div>
      {mapColumn}
      <div className="flex min-h-0 flex-col">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => {
            setRightPanelCollapsed(!rightPanelCollapsed);
          }}
          aria-label={rightPanelCollapsed ? "Expand valuables panel" : "Collapse valuables panel"}
          title={rightPanelCollapsed ? "Expand valuables panel" : "Collapse valuables panel"}
        >
          {rightPanelCollapsed ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
        {!rightPanelCollapsed && (
          <div className="min-h-0 w-80 overflow-y-auto">
            <GameDataGate>
              <MapValuablesPanel normalizedName={normalizedName} />
            </GameDataGate>
          </div>
        )}
      </div>
    </div>
  );
}
