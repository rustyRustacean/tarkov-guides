"use client";

import { useMapsHydrateOnMount } from "../hooks/use-hydrate-on-mount";
import { useMapsPersistenceSync } from "../hooks/use-persistence-sync";
import { useMapsStore } from "../store";

import { MapPicker } from "./MapPicker";
import { MapScreenLayout } from "./MapScreenLayout";

/**
 * Top-level shell for the Maps feature. Wires up the once-on-mount
 * localStorage hydration and the ongoing debounced persistence sync
 * (mirrors `ProgressTrackerPage`'s exact pattern), then renders the map
 * picker plus the fully-composed `MapScreenLayout` for whichever map is
 * currently selected (`useMapsStore`'s `currentMap`).
 *
 * Unlike Progress Tracker's page (a normal scrolling `max-w-5xl` content
 * column), this is a full-bleed viewport feature - `MapScreenLayout`'s
 * internal DOM assumes a real bounded height via `h-full` cascading
 * throughout its sidebar/viewer/valuables columns. The root layout's
 * `<main className="flex-1">` has no explicit height of its own (it only
 * grows to fill whatever `<body>` leaves over), so this page gives itself
 * an explicit height instead of depending on that cascade:
 * `calc(100vh-3.5rem)` matches the header's real height (`h-14`). Full
 * width, not `max-w-*`-constrained, so the 3-column map layout gets the
 * full viewport. `Footer`, rendered after `<main>` in the root layout, is
 * simply below the fold on this route - scrolling further reveals it,
 * same as any other overflowing page.
 */
export function MapsPage() {
  useMapsHydrateOnMount();
  useMapsPersistenceSync();

  const currentMap = useMapsStore((state) => state.currentMap);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col">
      <div className="border-border border-b p-3">
        <MapPicker />
      </div>
      <div className="min-h-0 flex-1">
        <MapScreenLayout normalizedName={currentMap} />
      </div>
    </div>
  );
}
