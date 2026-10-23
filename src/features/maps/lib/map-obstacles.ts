import type { ObstacleData } from "./grid-route";

/**
 * Per-map obstacle layers (buildings, water, fences, border), generated from
 * the map SVGs by `scripts/build-map-obstacles.mjs`. Loaded lazily, one map at
 * a time, so a visitor only downloads the map they are looking at.
 *
 * Keyed by the map tab's `normalizedName`. A map with no entry (Factory, Labs:
 * indoor, multi-floor, no ground level) simply has no obstacle routing.
 */
const LOADERS: Readonly<Record<string, () => Promise<{ default: ObstacleData }>>> = {
  customs: () => import("../data/obstacles/customs.json"),
  "ground-zero": () => import("../data/obstacles/ground-zero.json"),
  interchange: () => import("../data/obstacles/interchange.json"),
  lighthouse: () => import("../data/obstacles/lighthouse.json"),
  reserve: () => import("../data/obstacles/reserve.json"),
  shoreline: () => import("../data/obstacles/shoreline.json"),
  "streets-of-tarkov": () => import("../data/obstacles/streets-of-tarkov.json"),
  terminal: () => import("../data/obstacles/terminal.json"),
  woods: () => import("../data/obstacles/woods.json"),
};

/** Whether this map tab has obstacle layers generated for it. */
export function hasObstacleData(normalizedName: string): boolean {
  return normalizedName in LOADERS;
}

/** The map's obstacle layers, or `null` when it has none. */
export async function loadObstacles(normalizedName: string): Promise<ObstacleData | null> {
  const load = LOADERS[normalizedName];
  if (!load) return null;
  const loaded = await load();
  return loaded.default;
}
