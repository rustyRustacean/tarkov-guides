"use client";

import { useEffect, useRef } from "react";

import { useMapsStore } from "../store";

import { useMapSidebarHasContent } from "./use-map-sidebar-has-content";

/**
 * Defaults the Items/Tasks sidebar to collapsed the first time it's known
 * the current map has nothing in it (`useMapSidebarHasContent` resolves to
 * `false`) - an empty "Nothing active on this map" panel floating over the
 * viewport isn't worth the screen space for a profile (or lack of one) that
 * hasn't started anything here yet.
 *
 * Fires at most once per mount (a `ref` latch, not just a `hasContent`
 * effect dependency): `MapScreenLayout`'s own rule is that the panel must
 * never auto-collapse out from under the user once they've had a chance to
 * touch it - including on a later map switch, since `MapScreenLayout` stays
 * mounted across `normalizedName` prop changes rather than remounting.
 * `undefined` (game data/profile progress still loading) is a no-op, not a
 * trigger - see `useMapSidebarHasContent`'s own doc comment for why that
 * resolves to `false` (not a stuck `undefined`) once there's no active
 * profile at all.
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
