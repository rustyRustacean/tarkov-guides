"use client";

import { useMemo } from "react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { walkingRouteAvailable } from "../lib/exit-path-maps";
import { useRulerStore } from "../ruler-store";

import { useRoutes } from "./use-exit-path";

import type { PathResult } from "../lib/exit-path";
import type { RawMap } from "@/shared/lib/tarkov-api/types";

export interface RulerRoute {
  /** `null` until both points are placed. */
  route: PathResult | null;
  /** Both points are placed but there is no walkable way between them. */
  unreachable: boolean;
  /** The route is being worked out. */
  loading: boolean;
}

/**
 * The walking route between the ruler's two points, worked out on the server
 * over the same data as the exit path.
 */
export function useRulerRoute(normalizedName: string): RulerRoute {
  const a = useRulerStore((state) => state.a);
  const b = useRulerStore((state) => state.b);
  const on = useRulerStore((state) => state.on);
  const { data } = useTarkovGameData();
  const map = useMemo<RawMap | undefined>(
    () => data?.maps.find((candidate) => candidate.normalizedName === normalizedName),
    [data, normalizedName],
  );
  const targets = useMemo(() => (b ? [b] : []), [b]);
  // The ruler's on/off is global, so a map without walking data must not inherit "on".
  const { routes, pending, failed } = useRoutes(
    normalizedName,
    map,
    a,
    targets,
    on && b !== null && walkingRouteAvailable(normalizedName),
  );

  return useMemo(() => {
    if (a === null || b === null) return { route: null, unreachable: false, loading: false };
    if (pending) return { route: null, unreachable: false, loading: true };
    const route = routes?.[0] ?? null;
    return {
      route,
      unreachable: route === null && !failed && routes !== undefined,
      loading: false,
    };
  }, [a, b, routes, pending, failed]);
}
