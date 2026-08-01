"use client";

import { useGameDataBannerVisible } from "@/shared/lib/tarkov-api/use-game-data-banner-visible";
import { Card } from "@/shared/ui/card/Card";
import { cn } from "@/shared/ui/lib/cn";

import { useMapsHydrateOnMount } from "../hooks/use-hydrate-on-mount";
import { useMapsPersistenceSync } from "../hooks/use-persistence-sync";
import { MapSessionRoomProvider } from "../session/liveblocks-config";
import { useMapsStore } from "../store";

import { MapBossStrips } from "./MapBossStrips";
import { MapPicker } from "./MapPicker";
import { MapPickerRaidTime } from "./MapPickerRaidTime";
import { MapScreenLayout } from "./MapScreenLayout";
import { TarkovClock } from "./TarkovClock";

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
 * `calc(100vh-3.5rem)` matches the header's real height (`h-14`), further
 * reduced by another `2.25rem` (matching `GameDataStatusBanner`'s fixed
 * `h-9`) whenever `useGameDataBannerVisible()` says that banner is actually
 * on screen - both values are guessed/hardcoded Tailwind classes, not
 * measured, so they only stay correct as long as they're kept in sync with
 * those two components' real heights. Full width, not `max-w-*`-constrained,
 * so the 3-column map layout gets the full viewport. `ConditionalFooter`
 * (root layout) skips rendering `Footer` on this route so it doesn't add
 * dead scroll space below a screen meant to fill the viewport exactly.
 */
export function MapsPage() {
  useMapsHydrateOnMount();
  useMapsPersistenceSync();

  const currentMap = useMapsStore((state) => state.currentMap);
  const bannerVisible = useGameDataBannerVisible();

  return (
    // Wraps both `MapPicker` and `MapScreenLayout` - a collaborative
    // session's control-handoff gates map/variant switching in both places
    // (`MapPicker`'s map tabs, `MapVariantSwitcher`'s variant tabs), so both
    // need to be inside the same always-mounted room provider (see its own
    // doc comment for why it's unconditional rather than session-gated).
    <MapSessionRoomProvider>
      <div
        className={cn(
          "flex w-full flex-col",
          bannerVisible ? "h-[calc(100vh-3.5rem-2.25rem)]" : "h-[calc(100vh-3.5rem)]",
        )}
      >
        <div className="border-border flex flex-wrap items-center justify-between gap-3 border-b p-3">
          {/* Map tabs, with the current map's boss roster inline to their
              right (no separate ledge). Both wrap onto extra lines on narrow
              viewports rather than forcing horizontal scroll. */}
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <MapPicker />
            <MapBossStrips normalizedName={currentMap} />
          </div>
          <div className="flex items-center gap-3">
            <Card className="px-3 py-2">
              <TarkovClock />
            </Card>
            <MapPickerRaidTime normalizedName={currentMap} />
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <MapScreenLayout normalizedName={currentMap} />
        </div>
      </div>
    </MapSessionRoomProvider>
  );
}
