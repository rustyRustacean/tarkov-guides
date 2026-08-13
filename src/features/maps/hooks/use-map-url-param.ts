"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { MAP_NORMALIZED_NAMES } from "../lib/map-config";
import { useMapsStore } from "../store";

const MAP_PARAM = "map";

/**
 * Applies a `?map=NORMALIZED_NAME` deep link (e.g. Progress Tracker's map
 * recommendation dialog linking straight to a specific map) as the selected
 * map, then strips the param so a refresh/back-nav doesn't re-trigger it.
 * Mirrors `useSessionUrlParam`'s read-then-strip shape and needs the same
 * `Suspense` boundary around its caller (`useSearchParams`'s Next.js
 * requirement); see `MapUrlParamHandler`, which provides it.
 *
 * `setCurrentMap` runs inside a `setTimeout(fn, 0)` rather than
 * synchronously, so it fires after `useMapsHydrateOnMount`'s localStorage
 * read resolves and overwrites `currentMap` with the last-persisted map.
 * That read is synchronous `window.localStorage` work wrapped in an
 * already-resolved `Promise.resolve(...)` (see
 * `persistence/local-storage-adapter.ts`), not real I/O, so its
 * `hydrate()` call always finishes as a microtask before any macrotask
 * (what `setTimeout` schedules, even at 0ms) runs. A synchronous call here
 * would just get silently overwritten a tick later once hydration
 * resolves. If the persistence backend ever becomes genuinely async (e.g.
 * IndexedDB), this ordering guarantee needs revisiting.
 *
 * `appliedRef` makes the apply-and-strip sequence run at most once per
 * distinct `mapParam` value. Without it, `router.replace`'s re-render
 * (which changes `searchParams`, a dependency of this effect) would re-run
 * the effect before the timeout fires, and a naive cleanup-based
 * `clearTimeout` would cancel the pending `setCurrentMap` before it gets a
 * turn on the macrotask queue.
 */
export function useMapUrlParam(): void {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mapParam = searchParams.get(MAP_PARAM);
  const appliedRef = useRef<string | null>(null);

  useEffect(() => {
    if (mapParam === null || appliedRef.current === mapParam) return;
    appliedRef.current = mapParam;

    if (MAP_NORMALIZED_NAMES.includes(mapParam)) {
      setTimeout(() => {
        useMapsStore.getState().setCurrentMap(mapParam);
      }, 0);
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete(MAP_PARAM);
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [mapParam, pathname, router, searchParams]);
}
