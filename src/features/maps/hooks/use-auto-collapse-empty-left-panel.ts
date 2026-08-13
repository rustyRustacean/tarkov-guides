"use client";

import { useEffect, useRef } from "react";

import { useMapsStore } from "../store";

import { useMapSidebarHasContent } from "./use-map-sidebar-has-content";

/**
 * Collapses the Items/Tasks sidebar the first time the current map is known
 * to have nothing in it (`useMapSidebarHasContent` resolves to `false`),
 * since an empty panel isn't worth the screen space.
 *
 * Fires at most once per mount, via a ref latch rather than a `hasContent`
 * dependency: `MapScreenLayout` never remounts on a map switch, and once the
 * user has had a chance to touch the panel it must not auto-collapse again.
 * `undefined` (data still loading) is a no-op; see `useMapSidebarHasContent`
 * for why that resolves to `false`, not a stuck `undefined`, once there's no
 * active profile.
 */
export function useAutoCollapseEmptyLeftPanel(normalizedName: string): void {
  const hasContent = useMapSidebarHasContent(normalizedName);
  const setLeftPanelCollapsed = useMapsStore((state) => state.setLeftPanelCollapsed);
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current || hasContent === undefined) return;
    firedRef.current = true;
    if (!hasContent) setLeftPanelCollapsed(true);
  }, [hasContent, setLeftPanelCollapsed]);
}
