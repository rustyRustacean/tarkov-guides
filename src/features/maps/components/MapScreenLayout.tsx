"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/shared/ui/button/Button";

import { useFullscreen } from "../hooks/use-fullscreen";
import { useIsMobileViewport } from "../hooks/use-is-mobile-viewport";
import { useSheetDrag } from "../hooks/use-sheet-drag";
import { useMapsStore } from "../store";

import { MapHeader } from "./MapHeader";
import { MapSidebar } from "./MapSidebar";
import { MapValuablesPanel } from "./MapValuablesPanel";
import { MapViewerLazy } from "./MapViewerLazy";
import { TarkovClock } from "./TarkovClock";

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
 */
export function MapScreenLayout({ normalizedName }: Props) {
  const isMobile = useIsMobileViewport();
  const { ref: fullscreenRef, isFullscreen, toggle: toggleFullscreen } = useFullscreen();

  const rightPanelCollapsed = useMapsStore((state) => state.rightPanelCollapsed);
  const setRightPanelCollapsed = useMapsStore((state) => state.setRightPanelCollapsed);

  const mobileSheetOpen = useMapsStore((state) => state.mobileSheetOpen);
  const setMobileSheetOpen = useMapsStore((state) => state.setMobileSheetOpen);
  const { handleRef, containerRef } = useSheetDrag({
    isOpen: mobileSheetOpen,
    onOpenChange: setMobileSheetOpen,
  });

  const mapColumn = (
    <div ref={fullscreenRef} className="bg-background relative flex h-full min-h-0 flex-col">
      <MapHeader
        normalizedName={normalizedName}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />
      <div className="relative min-h-0 flex-1">
        <MapViewerLazy normalizedName={normalizedName} />
        <div className="bg-background/90 border-border pointer-events-none absolute top-3 right-3 z-[1000] rounded-md border px-2 py-1 shadow-sm backdrop-blur-sm">
          <TarkovClock />
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
            <MapSidebar normalizedName={normalizedName} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-[320px_minmax(0,1fr)_auto] gap-2">
      <div className="min-h-0 overflow-y-auto">
        <MapSidebar normalizedName={normalizedName} />
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
            <MapValuablesPanel normalizedName={normalizedName} />
          </div>
        )}
      </div>
    </div>
  );
}
