"use client";

import { useMapsHydrateOnMount } from "../hooks/use-hydrate-on-mount";
import { useMapsPersistenceSync } from "../hooks/use-persistence-sync";
import { MapSessionRoomProvider } from "../session/liveblocks-config";
import { useMapsStore } from "../store";

import { MapPicker } from "./MapPicker";
import { MapPickerRaidTime } from "./MapPickerRaidTime";
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
 * full viewport. `ConditionalFooter` (root layout) skips rendering `Footer`
 * on this route so it doesn't add dead scroll space below a screen meant
 * to fill the viewport exactly.
 */
export function MapsPage() {
  useMapsHydrateOnMount();
  useMapsPersistenceSync();

  const currentMap = useMapsStore((state) => state.currentMap);

  return (
    // Wraps both `MapPicker` and `MapScreenLayout` - a collaborative
    // session's control-handoff gates map/variant switching in both places
    // (`MapPicker`'s map tabs, `MapVariantSwitcher`'s variant tabs), so both
    // need to be inside the same always-mounted room provider (see its own
    // doc comment for why it's unconditional rather than session-gated).
    <MapSessionRoomProvider>
      <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col">
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b p-3">
          <MapPicker />
          <MapPickerRaidTime normalizedName={currentMap} />
        </div>
        <div className="min-h-0 flex-1">
          <MapScreenLayout normalizedName={currentMap} />
        </div>
      </div>
    </MapSessionRoomProvider>
  );
}
