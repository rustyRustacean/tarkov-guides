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
 * `Suspense` boundary around its caller (`useSearchParams`'s own Next.js
 * requirement) - see `MapUrlParamHandler`, which provides it.
 *
 * `setCurrentMap` is applied inside a `setTimeout(fn, 0)`, not called
 * synchronously, so it runs after `useMapsHydrateOnMount`'s localStorage
 * read resolves and overwrites `currentMap` with the last-persisted map.
 * That read is genuinely synchronous `window.localStorage` work wrapped in
 * an already-resolved `Promise.resolve(...)` (see
 * `persistence/local-storage-adapter.ts`), not real I/O - so its
 * `hydrate()` call is guaranteed to finish as a microtask before any
 * macrotask (which `setTimeout` always schedules, even at 0ms) runs. A
 * plain synchronous call here would just get silently overwritten a tick
 * later once that hydration resolves. If the persistence backend ever
 * becomes genuinely async (e.g. IndexedDB), this ordering guarantee would
 * need revisiting.
 *
 * `appliedRef` makes the apply-and-strip sequence run at most once per
 * distinct `mapParam` value - without it, `router.replace`'s own re-render
 * (which changes `searchParams`, a dependency of this effect) would re-run
 * the effect before the timeout fires, and a naive cleanup-based
 * `clearTimeout` would cancel the pending `setCurrentMap` before it ever
 * gets a turn on the macrotask queue.
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
