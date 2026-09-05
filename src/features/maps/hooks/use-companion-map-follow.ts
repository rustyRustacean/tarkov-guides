"use client";

import { useEffect, useMemo, useRef } from "react";

import { useCompanionStatus, useMapFollowPreference } from "@/features/companion/use-companion";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import {
  getMapConfig,
  markerVariantId,
  resolveVariantId,
  variantHasAccurateMarkers,
} from "../lib/map-config";
import { tabForRaidLocation } from "../lib/raid-location";
import { useMapsStore } from "../store";

import type { RawMap } from "@/shared/lib/tarkov-api/types";

/**
 * Which map tab (if any) the tracker should switch to for a location id,
 * given the map already open. Pure so the actual switching decision - not
 * just the id -> tab resolution `tabForRaidLocation` already covers - is
 * directly testable: returns `null` both when the id can't be resolved and
 * when it resolves to the map already showing (nothing to do either way).
 */
export function decideMapFollowTarget(
  nameId: string | null,
  maps: readonly RawMap[],
  currentMap: string,
): string | null {
  const tab = tabForRaidLocation(nameId, maps);
  return tab !== null && tab !== currentMap ? tab : null;
}

/**
 * Following a raid means the user wants to SEE the marker, so a switch also
 * has to land on a variant that can show it - `setCurrentMap` alone lands on
 * the map's sticky variant, and a remembered "2D" selection then hides the
 * marker the switch existed to reveal. No-op when the stored variant already
 * shows markers (never fights a deliberate Overview/Satellite choice), and
 * when no variant on that map can (nothing sensible to switch to).
 */
function ensureMarkerVariant(
  normalizedName: string,
  storedVariantId: string | null,
  setMapVariant: (normalizedName: string, variantId: string) => void,
): void {
  const config = getMapConfig(normalizedName);
  if (!config) return;
  const resolved = config.variants.find(
    (variant) => variant.id === resolveVariantId(config.variants, storedVariantId),
  );
  if (resolved && variantHasAccurateMarkers(resolved)) return;
  const target = markerVariantId(config.variants);
  if (target) setMapVariant(normalizedName, target);
}

/**
 * App-wide (but Maps-only, by virtue of only ever being mounted from
 * `MapsPage`) side effect: keep the open map - and its variant, via
 * `ensureMarkerVariant` - in step with wherever the game actually is. Two
 * independent triggers, both gated on the "Auto open map on raid start"
 * preference (CompanionButton's checkbox, default OFF):
 *
 * 1. A new raid starts (`status.raidLocation` changes to a fresh value) -
 *    jump the Maps tab to that raid's map.
 * 2. A new in-raid screenshot arrives (`status.positionRevision` bumps) -
 *    jump to ITS map first, before `PlayerMarker`'s own
 *    `positionBelongsOnMap` check ever sees the new position, so the marker
 *    only ever appears already on the right map (kills the
 *    place-icon-then-clear-icon flash).
 *
 * Neither trigger is consumed while game data hasn't loaded: the companion's
 * tiny /status always answers before the multi-MB game-data fetch, and
 * advancing the dedupe refs at that moment permanently ate the raid-start
 * switch (the id couldn't be resolved to a tab yet, and afterwards the ref
 * claimed the raid was already handled).
 *
 * Screenshot-driven switches are deliberately NOT deduped by resolved map -
 * every new `positionRevision` re-asserts it, so navigating away mid-raid and
 * then taking another screenshot on the same map still pulls you back
 * ("follow", not "follow once"). Raid-start switches ARE deduped by the raw
 * `raidLocation` value (no per-raid id exists to key on instead), so two
 * consecutive raids on the identical map - after manually navigating away in
 * between - won't re-trigger a pull-back. That's a real, known gap, not an
 * oversight; closing it would mean adding a revision counter to the
 * companion payload for a case that's rare even before accounting for how
 * rarely anyone navigates away mid-session in the first place.
 */
export function useCompanionMapFollow(): void {
  const [enabled] = useMapFollowPreference();
  const { status } = useCompanionStatus(enabled);
  const { data } = useTarkovGameData();
  const currentMap = useMapsStore((state) => state.currentMap);
  const setCurrentMap = useMapsStore((state) => state.setCurrentMap);
  const mapVariants = useMapsStore((state) => state.mapVariants);
  const setMapVariant = useMapsStore((state) => state.setMapVariant);
  const lastRaidLocationRef = useRef<string | null>(null);
  const lastPositionRevisionRef = useRef<number | null>(null);

  // `data?.maps ?? []` would mint a fresh empty-array identity every render
  // while game data is still loading, which is exactly what
  // `react-hooks/exhaustive-deps` flags as an effect dependency that changes
  // every render for no real reason - memoized so it's only a new reference
  // when `data` itself actually changes.
  const maps = useMemo<readonly RawMap[]>(() => data?.maps ?? [], [data]);
  const raidLocation = status?.raidLocation ?? null;

  useEffect(() => {
    if (!enabled) {
      lastRaidLocationRef.current = null;
      return;
    }
    // Game data not loaded yet: leave the trigger unconsumed. Advancing the
    // ref here permanently ate the raid-start switch whenever the companion's
    // status answered before the (much larger) game-data fetch - the id could
    // not be resolved to a tab at that moment, and by the time maps existed
    // the ref already claimed the raid was handled.
    if (maps.length === 0) return;
    if (raidLocation === null || raidLocation === lastRaidLocationRef.current) return;
    lastRaidLocationRef.current = raidLocation;

    // Whether this switches maps or the raid's map is already open, the
    // variant there must be able to display the marker - that is what
    // following is FOR.
    const tab = tabForRaidLocation(raidLocation, maps);
    if (tab === null) return;
    if (tab !== currentMap) setCurrentMap(tab);
    ensureMarkerVariant(tab, mapVariants[tab] ?? null, setMapVariant);
  }, [enabled, raidLocation, maps, currentMap, setCurrentMap, mapVariants, setMapVariant]);

  const positionRevision = status?.positionRevision ?? null;
  const positionMap = status?.position?.map ?? null;

  useEffect(() => {
    if (!enabled) {
      lastPositionRevisionRef.current = null;
      return;
    }
    if (maps.length === 0) return;
    if (positionRevision === null || positionRevision === lastPositionRevisionRef.current) return;
    lastPositionRevisionRef.current = positionRevision;

    const tab = tabForRaidLocation(positionMap, maps);
    if (tab === null) return;
    if (tab !== currentMap) setCurrentMap(tab);
    ensureMarkerVariant(tab, mapVariants[tab] ?? null, setMapVariant);
  }, [
    enabled,
    positionRevision,
    positionMap,
    maps,
    currentMap,
    setCurrentMap,
    mapVariants,
    setMapVariant,
  ]);
}
