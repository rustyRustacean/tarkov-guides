"use client";

import dynamic from "next/dynamic";

/**
 * `MapViewer` imports `leaflet`, which touches `window` at module load time.
 * A plain static import broke `next build`'s prerender with
 * `ReferenceError: window is not defined`, so it's loaded via `next/dynamic`
 * with `ssr: false`. `next/dynamic` requires this call inside a Client
 * Component, hence this thin wrapper instead of calling `dynamic()` directly
 * in a route file that might otherwise stay a server component.
 */
export const MapViewerLazy = dynamic(
  () => import("./MapViewer").then((mod) => ({ default: mod.MapViewer })),
  { ssr: false },
);
