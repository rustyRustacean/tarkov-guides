import { fetchJsonApiResource } from "@/shared/lib/tarkov-api/fetch-json-resource";

import {
  FAILURE_MEMORY_MS,
  FETCH_TIMEOUT_MS,
  MAP_DATA_TTL_MS,
  MAX_COORDINATE_M,
} from "../lib/route-limits";

import type { Point } from "../lib/exit-path";
import type { JsonApiMapsData } from "@/shared/lib/tarkov-api/json-api-types";

/**
 * What the server itself knows about a map for routing: its minefield outlines
 * and the position of every exit and transit. It comes from tarkov.dev, never
 * from the browser, so one request cannot change what another request is
 * routed around.
 */
export interface MapRouteData {
  minefields: Point[][];
  /** Every exit and transit position, so the obstacle grid always covers them (flare and sniper exits sit outside the drawn map). */
  anchors: Point[];
}

/** Used when no data could be fetched yet. A fresh object each time the real data arrives replaces it. */
export const NO_MAP_DATA: MapRouteData = { minefields: [], anchors: [] };

interface Loaded {
  at: number;
  byMap: ReadonlyMap<string, MapRouteData>;
}

let loaded: Loaded | null = null;
let inflight: Promise<Loaded> | null = null;
let failedAt = 0;

function usable(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= MAX_COORDINATE_M;
}

function usablePoint(p: { x?: unknown; z?: unknown } | null | undefined): p is Point {
  return p !== null && p !== undefined && usable(p.x) && usable(p.z);
}

/** Reduces the raw maps payload to what routing needs, dropping anything malformed. */
export function readMapRouteData(data: JsonApiMapsData): ReadonlyMap<string, MapRouteData> {
  const byMap = new Map<string, MapRouteData>();
  for (const map of Object.values(data.maps)) {
    const minefields: Point[][] = [];
    for (const hazard of map.hazards ?? []) {
      if (hazard.hazardType !== "minefield" || hazard.outline === null) continue;
      const outline = hazard.outline.filter(usablePoint).map((p) => ({ x: p.x, z: p.z }));
      if (outline.length >= 3 && outline.length === hazard.outline.length) minefields.push(outline);
    }
    const anchors: Point[] = [];
    for (const exit of [...(map.extracts ?? []), ...(map.transits ?? [])]) {
      if (usablePoint(exit.position)) anchors.push({ x: exit.position.x, z: exit.position.z });
    }
    byMap.set(map.normalizedName, { minefields, anchors });
  }
  return byMap;
}

async function fetchAll(now: number): Promise<Loaded> {
  const data = await fetchJsonApiResource<JsonApiMapsData>(
    "maps",
    "regular",
    AbortSignal.timeout(FETCH_TIMEOUT_MS),
  );
  return { at: now, byMap: readMapRouteData(data) };
}

/**
 * The map's exits and minefields, cached for hours and shared by every
 * request. A failed fetch is not retried on every request: the last good data
 * (however old) is kept, or `NO_MAP_DATA` if there never was any. Returns
 * `null` for a map the data does not list.
 */
export async function getMapRouteData(map: string, now = Date.now()): Promise<MapRouteData | null> {
  const fresh = loaded !== null && now - loaded.at < MAP_DATA_TTL_MS;
  const coolingDown = now - failedAt < FAILURE_MEMORY_MS;
  if (!fresh && !coolingDown) {
    inflight ??= fetchAll(now)
      .then((result) => {
        loaded = result;
        return result;
      })
      .catch((error: unknown) => {
        failedAt = now;
        console.error("[route-path] map data fetch failed:", error);
        if (loaded === null) throw error;
        return loaded;
      })
      .finally(() => {
        inflight = null;
      });
    try {
      await inflight;
    } catch {
      return NO_MAP_DATA;
    }
  }
  if (loaded === null) return NO_MAP_DATA;
  return loaded.byMap.get(map) ?? null;
}

/** For tests: forget everything cached. */
export function resetMapRouteData(): void {
  loaded = null;
  inflight = null;
  failedAt = 0;
}
