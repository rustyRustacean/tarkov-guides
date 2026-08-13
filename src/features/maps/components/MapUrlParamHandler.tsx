"use client";

import { useMapUrlParam } from "../hooks/use-map-url-param";

/**
 * Render-nothing host for `useMapUrlParam`, so its `useSearchParams` call
 * gets its own small `Suspense` boundary (see the hook's doc comment)
 * without wrapping the whole page in one. `MapsPage` renders this wrapped
 * in `<Suspense fallback={null}>`, the same shape `MapScreenLayout` already
 * uses for `SessionControls`.
 */
export function MapUrlParamHandler(): null {
  useMapUrlParam();
  return null;
}
