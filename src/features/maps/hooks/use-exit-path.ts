"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { useCompanionPosition } from "@/features/companion/use-companion";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { useExitPathStore } from "../exit-path-store";
import { useExitSnipStore } from "../exit-snip-store";
import {
  chooseTarget,
  exitKey,
  type ExitTarget,
  type PathResult,
  type Point,
  type Router,
} from "../lib/exit-path";
import { walkingRouteAvailable } from "../lib/exit-path-maps";
import { tabForRaidLocation, positionBelongsOnMap } from "../lib/raid-location";
import { fetchRoutes } from "../lib/route-api";
import { REUSE_TOLERANCE_M, trimRoute } from "../lib/route-reuse";

import type { AppliedExit } from "../lib/exit-snip";
import type { RawMap } from "@/shared/lib/tarkov-api/types";

export type ExitPathStatus =
  /** Go to Exit is off. */
  | "off"
  /** On, but there are no exits to go to (no snip applied and not testing). */
  | "no-exits"
  /** On, with exits, but no position to start from yet. */
  | "no-position"
  | "ready";

export interface ExitPathView {
  status: ExitPathStatus;
  /** Where the path starts: the tester point, or the companion's last position. */
  start: Point | null;
  startSource: "test" | "raid" | null;
  /** Exits belonging to this map from the applied snip. */
  listed: readonly AppliedExit[];
  /** Every other exit of the map, from the map data (for "Show all exits" and the tester). */
  others: readonly AppliedExit[];
  target: ExitTarget | null;
  /** The route is being worked out and there is no earlier one to show yet. */
  routing: boolean;
}

const NONE: readonly AppliedExit[] = [];

/** Rounded so a screenshot a few centimetres away reuses the last answer. */
function cell(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * The last routes answered for each map and set of targets. While the player
 * keeps walking along that line the old answer is trimmed instead of asking
 * the server again (see `trimRoute`); the server is asked only when the
 * player leaves the line or picks different exits.
 */
const ROUTE_MEMORY = new Map<string, (PathResult | null)[]>();
const ROUTE_MEMORY_MAX = 24;

function remember(key: string, routes: (PathResult | null)[]): void {
  ROUTE_MEMORY.delete(key);
  ROUTE_MEMORY.set(key, routes);
  if (ROUTE_MEMORY.size > ROUTE_MEMORY_MAX) {
    const oldest = ROUTE_MEMORY.keys().next();
    if (!oldest.done) ROUTE_MEMORY.delete(oldest.value);
  }
}

/** The remembered routes seen from `from`, or `null` when any of them needs a fresh answer. */
function reuseRoutes(key: string, from: Point): (PathResult | null)[] | null {
  const previous = ROUTE_MEMORY.get(key);
  if (previous === undefined || previous.length === 0) return null;
  const out: (PathResult | null)[] = [];
  for (const route of previous) {
    if (route === null) return null;
    const trimmed = trimRoute(route, from, REUSE_TOLERANCE_M);
    if (trimmed === null) return null;
    out.push(trimmed);
  }
  return out;
}

/**
 * Walking routes from `from` to each target, worked out on the server over the
 * map's private walkable data. The previous answer stays on screen while the
 * next one is fetched, so the line never blinks off between position updates,
 * and a player still on the line costs no request at all.
 */
export function useRoutes(
  normalizedName: string,
  map: RawMap | undefined,
  from: Point | null,
  targets: readonly { x: number; z: number; y?: number | null | undefined }[],
  enabled: boolean,
): { routes: (PathResult | null)[] | undefined; pending: boolean; failed: boolean } {
  const key = targets.map((t) => `${String(cell(t.x))},${String(cell(t.z))}`).join(";");
  const memoryKey = `${normalizedName}|${key}`;
  const active = enabled && map !== undefined && from !== null && targets.length > 0;
  const fromX = from?.x ?? null;
  const fromZ = from?.z ?? null;

  const reused = useMemo(
    () =>
      active && fromX !== null && fromZ !== null
        ? reuseRoutes(memoryKey, { x: fromX, z: fromZ })
        : null,
    [active, memoryKey, fromX, fromZ],
  );

  const query = useQuery({
    queryKey: [
      "route-path",
      normalizedName,
      fromX === null ? null : cell(fromX),
      fromZ === null ? null : cell(fromZ),
      key,
    ],
    queryFn: ({ signal }) => {
      if (from === null) return Promise.resolve<(PathResult | null)[]>([]);
      return fetchRoutes(
        {
          map: normalizedName,
          from: { x: from.x, z: from.z },
          to: targets.map((t) => ({
            x: t.x,
            z: t.z,
            ...(typeof t.y === "number" ? { y: t.y } : {}),
          })),
        },
        // A newer position replaces this request: cancel it rather than let
        // a burst of screenshots queue up answers nobody will read.
        signal,
      );
    },
    enabled: active && reused === null,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    gcTime: 60_000,
    retry: 1,
  });

  const fresh = query.isPlaceholderData || query.isFetching ? undefined : query.data;
  useEffect(() => {
    if (reused !== null) remember(memoryKey, reused);
    else if (fresh !== undefined && fresh.length > 0) remember(memoryKey, fresh);
  }, [memoryKey, reused, fresh]);

  const routes = reused ?? query.data;
  return {
    routes,
    pending: active && reused === null && query.isFetching && query.data === undefined,
    failed: active && reused === null && query.isError,
  };
}

/** A map-data exit shaped like an applied one, so one code path routes both. */
export function fromMapData(map: RawMap): AppliedExit[] {
  const out: AppliedExit[] = [];
  for (const extract of map.extracts ?? []) {
    // A PMC's list is pmc + shared; scav-only exits are not shown by default.
    if (extract.faction === "scav") continue;
    out.push({
      kind: "exfil",
      id: extract.id,
      name: extract.name,
      position: extract.position,
      unknown: false,
      match: "exact",
    });
  }
  for (const transit of map.transits ?? []) {
    out.push({
      kind: "transit",
      id: transit.id,
      name: transit.name,
      position: transit.position,
      unknown: false,
      match: "exact",
    });
  }
  return out;
}

/**
 * Everything the exit path UI and layers need for one map tab, derived in one
 * place so the controls' text and the drawn line can never disagree.
 */
export function useExitPath(normalizedName: string): ExitPathView {
  const { data } = useTarkovGameData();
  const maps = useMemo<readonly RawMap[]>(() => data?.maps ?? [], [data]);
  const snip = useExitSnipStore((state) => state.snip);
  const pathRequested = useExitPathStore((state) => state.pathOn);
  // The toggle is global, so a map without walking data must not inherit "on".
  const pathOn = pathRequested && walkingRouteAvailable(normalizedName);
  const testMode = useExitPathStore((state) => state.testMode);
  const testPoint = useExitPathStore((state) => state.testPoint);
  const selectedKey = useExitPathStore((state) => state.selectedKey);
  const position = useCompanionPosition();

  const map = useMemo(
    () => maps.find((candidate) => candidate.normalizedName === normalizedName),
    [maps, normalizedName],
  );

  const listed = useMemo<readonly AppliedExit[]>(() => {
    if (snip === null) return NONE;
    return tabForRaidLocation(snip.nameId, maps) === normalizedName ? snip.exits : NONE;
  }, [snip, maps, normalizedName]);

  const mapExits = useMemo<readonly AppliedExit[]>(() => (map ? fromMapData(map) : NONE), [map]);

  const others = useMemo<readonly AppliedExit[]>(() => {
    const listedKeys = new Set(listed.map((exit) => exitKey(exit)));
    return mapExits.filter((exit) => !listedKeys.has(exitKey(exit)));
  }, [listed, mapExits]);

  // TEMP-TESTER (to be removed): the tester replaces the raid position, and
  // its exits come from the map data when no snip has been applied here.
  // Without it this is just: raid position if it belongs to this map.
  let start: Point | null = null;
  let startSource: "test" | "raid" | null = null;
  if (testMode) {
    start = testPoint;
    startSource = testPoint ? "test" : null;
  } else if (position && positionBelongsOnMap(position.map, normalizedName, maps)) {
    start = { x: position.x, z: position.z };
    startSource = "raid";
  }

  // No snip, but an exit was picked with the exit keys: that one alone is routed.
  const pickedFromMap = useMemo(
    () =>
      listed.length === 0 && selectedKey !== null
        ? mapExits.find((exit) => exitKey(exit) === selectedKey)
        : undefined,
    [listed, selectedKey, mapExits],
  );
  const pickedOnly = useMemo(() => (pickedFromMap ? [pickedFromMap] : NONE), [pickedFromMap]);

  let candidates = listed;
  if (testMode && listed.length === 0) candidates = mapExits;
  else if (pickedOnly.length > 0) candidates = pickedOnly;

  // Only what is needed is asked for: the picked exit alone, else every
  // available exfil (the closest one is chosen from their routes).
  const wanted = useMemo(() => {
    const located = candidates.filter(
      (exit): exit is AppliedExit & { position: { x: number; y: number; z: number } } =>
        exit.position !== null,
    );
    const picked = located.find((exit) => exitKey(exit) === selectedKey);
    if (picked) return [picked];
    return located.filter((exit) => exit.kind === "exfil" && !exit.unknown);
  }, [candidates, selectedKey]);

  const startX = start?.x ?? null;
  const startZ = start?.z ?? null;
  const from = useMemo(
    () => (startX !== null && startZ !== null ? { x: startX, z: startZ } : null),
    [startX, startZ],
  );
  const targets = useMemo(() => wanted.map((exit) => exit.position), [wanted]);
  const { routes, pending } = useRoutes(
    normalizedName,
    map,
    from,
    targets,
    pathOn && candidates.length > 0,
  );

  const target = useMemo<ExitTarget | null>(() => {
    if (!pathOn || from === null || candidates.length === 0 || routes === undefined) return null;
    const byPosition = new Map<string, PathResult | null>();
    wanted.forEach((exit, index) => {
      byPosition.set(
        `${String(exit.position.x)},${String(exit.position.z)}`,
        routes[index] ?? null,
      );
    });
    const router: Router = (to) => byPosition.get(`${String(to.x)},${String(to.z)}`) ?? null;
    return chooseTarget(candidates, selectedKey, router);
  }, [pathOn, from, candidates, routes, wanted, selectedKey]);

  let status: ExitPathStatus = "ready";
  if (!pathOn) status = "off";
  else if (candidates.length === 0) status = "no-exits";
  else if (start === null) status = "no-position";

  return { status, start, startSource, listed, others, target, routing: pending };
}
