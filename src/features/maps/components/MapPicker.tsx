"use client";

import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import { getMapConfig, MAP_NORMALIZED_NAMES } from "../lib/map-config";
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
 */
export function MapPicker() {
  const currentMap = useMapsStore((state) => state.currentMap);
  const setCurrentMap = useMapsStore((state) => state.setCurrentMap);

  return (
    <Tabs
      value={currentMap}
      onValueChange={(normalizedName) => {
        setCurrentMap(normalizedName);
      }}
    >
      <TabsList className="h-auto flex-wrap">
        {MAP_NORMALIZED_NAMES.map((normalizedName) => {
          const config = getMapConfig(normalizedName);
          if (!config) return null;
          return (
            <TabsTrigger key={normalizedName} value={normalizedName}>
              {config.name}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
