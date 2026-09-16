"use client";

import { Map as MapIcon } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import { getMapConfig, MAP_NORMALIZED_NAMES } from "../lib/map-config";
import { useMapsSession } from "../session/use-maps-session";
import { useMapsStore } from "../store";

/**
 * Top-level map switcher, ported from `old/TarkovTrackerWB-main`'s flat
 * `#map-bar` row of 13 map-name buttons (no icons/thumbnails), restyled as
 * a `Tabs` trigger row using the same idiom `MapVariantSwitcher` already
 * established for its own "many options, pick one" case. Selection is
 * purely client-side (`useMapsStore`'s `currentMap`/`setCurrentMap`, already
 * persisted), no URL segment or query param: legacy itself never reflected
 * the selected map in the URL either.
 *
 * During a collaborative session, only the current controller may switch
 * maps: everyone else's tabs are disabled (with a tooltip via `title`)
 * rather than letting a click get silently overwritten by the next incoming
 * `SessionViewSync` broadcast (`MapViewer.tsx`).
 */
export function MapPicker() {
  const currentMap = useMapsStore((state) => state.currentMap);
  const setCurrentMap = useMapsStore((state) => state.setCurrentMap);
  const session = useMapsSession();
  const locked = session.active && !session.isController;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <MapIcon className="text-primary hidden size-5 shrink-0 sm:block" aria-hidden="true" />
      <Tabs
        value={currentMap}
        onValueChange={(normalizedName) => {
          if (locked) return;
          setCurrentMap(normalizedName);
        }}
      >
        <TabsList className="h-auto flex-wrap">
          {MAP_NORMALIZED_NAMES.map((normalizedName) => {
            const config = getMapConfig(normalizedName);
            if (!config) return null;
            return (
              <TabsTrigger
                key={normalizedName}
                value={normalizedName}
                disabled={locked}
                title={locked ? "Only the session driver can change maps" : undefined}
                // Two small additions on top of the shared `Tabs` defaults
                // (picked from the "Map Tab Touches" artifact's option 02):
                // an inactive tab now gets hover feedback at all (there was
                // none before), and the active tab's plain light-gray fill
                // becomes a soft tint of the theme's own accent color
                // (`--color-primary`, amber on Inventory Grid, whatever the
                // active theme's accent is otherwise) instead of a generic
                // "selected" gray, plus a hairline ring of the same color
                // standing in for the removed drop shadow.
                className="[&:not([data-state=active])]:hover:bg-accent data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-none data-[state=active]:ring-1 data-[state=active]:ring-primary/30 data-[state=active]:ring-inset"
              >
                {config.name}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>
    </div>
  );
}
