"use client";

import dynamic from "next/dynamic";

/**
 * `MapViewer` imports `leaflet`, which touches `window` at module load time
 * (a well-known Leaflet/SSR incompatibility - confirmed directly: a plain
 * static import broke `next build`'s prerender pass with
 * `ReferenceError: window is not defined`). Loaded via `next/dynamic` with
 * `ssr: false` so it only ever loads/renders on the client; `next/dynamic`
 * requires this to be called from within a Client Component, hence this
 * thin wrapper rather than calling `dynamic()` directly in a route file
 * that might otherwise stay a server component.
 */
export const MapViewerLazy = dynamic(
  () => import("./MapViewer").then((mod) => ({ default: mod.MapViewer })),
  { ssr: false },
);
