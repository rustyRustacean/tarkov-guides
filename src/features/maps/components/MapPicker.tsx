"use client";

import { Map as MapIcon } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import { getMapConfig, MAP_NORMALIZED_NAMES } from "../lib/map-config";
import { useMapsSession } from "../session/use-maps-session";
import { useMapsStore } from "../store";

/**
 * Top-level map switcher - ported from `old/TarkovTrackerWB-main`'s flat
 * `#map-bar` row of 13 map-name buttons (no icons/thumbnails), restyled as
 * a `Tabs` trigger row using the same idiom `MapVariantSwitcher` already
 * established for its own "many options, pick one" case. Selection is
 * purely client-side (`useMapsStore`'s `currentMap`/`setCurrentMap`, already
 * persisted) - no URL segment or query param, per the Phase 5 step 13
 * decision that legacy itself never reflected the selected map in the URL
 * either.
 *
 * During a collaborative session, only the current controller may switch
 * maps - everyone else's tabs are disabled (with a tooltip via `title`)
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
