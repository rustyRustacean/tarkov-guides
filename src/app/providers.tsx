"use client";

import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";

import { CompanionAutoLauncher } from "@/features/companion/CompanionAutoLauncher";
import { DeviceSyncRoomProvider } from "@/features/companion/device-sync-config";
import { useHydrateOnMount } from "@/features/progress-tracker/hooks/use-hydrate-on-mount";
import { usePersistenceSync } from "@/features/progress-tracker/hooks/use-persistence-sync";
import { ThemeProvider } from "@/shared/ui/theme/ThemeProvider";
import { Toaster } from "@/shared/ui/toast/Toast";
import { TooltipProvider } from "@/shared/ui/tooltip/Tooltip";

import { DetailDialogsLazy } from "./DetailDialogsLazy";

/** localStorage key the persisted query cache is written under. Bump the trailing version if `TarkovGameData`'s shape ever changes in a breaking way - see `QUERY_CACHE_BUSTER` below, the idiomatic replacement for legacy's ad hoc schema-migration checks. */
const QUERY_CACHE_STORAGE_KEY = "tarkovguides.query-cache.v1";
/**
 * Passed as `persistOptions.buster` - bump this string (not the storage key
 * above) on any breaking change to a cached query's shape; React Query
 * discards a persisted cache whose buster doesn't match. Bumped to `v2`
 * for the 2026-07-29 GraphQL→JSON API migration: `TarkovGameData`'s shape
 * didn't change, but the underlying data source did (subtly different
 * values - e.g. previously GraphQL-sourced field quirks now resolved
 * differently) - a defensive bump avoids a returning visitor's browser
 * mixing data fetched from the old, now-defunct upstream with fresh JSON
 * API data. Bumped to `v3` (2026-08-01): `RawMap.bosses`' shape changed
 * (boss entries now carry a resolved `name`/`normalizedName`/
 * `imagePortraitLink` from the JSON API's `mobs` metadata instead of the
 * old assumed `name`/`spawnLocations`), so a persisted v2 snapshot would
 * render the old, name-less boss strip until its 24h TTL lapsed.
 */
const QUERY_CACHE_BUSTER = "v3";
/** Hard cutoff for a persisted cache's age, matching legacy's `refreshData.js` 24h localStorage TTL. Distinct from `staleTime` below - this deletes stale data outright, staleTime only governs background revalidation. */
const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Heads up Nikolai, lengthy explanation lol. Essentially I wrapped the
 * app with every app-wide React context provider: TanStack Query
 * (all remote/server data - primarily the tarkov.dev GraphQL API, see
 * `src/shared/lib/tarkov-api`), the design system's `ThemeProvider`, a
 * single Radix `TooltipProvider` (Radix requires exactly one, shared by
 * every `Tooltip` instance in the tree - do not mount another one
 * per-component), and the single `Toaster` that renders whatever the
 * imperative `toast()` API (`shared/ui/toast/toast-store`) triggers.
 * Client-only domain state with no server counterpart (user progress, etc.)
 * is handled separately via Zustand stores. Progress Tracker's own
 * hydrate-on-mount/persistence-sync hooks are wired in HERE (not inside
 * `ProgressTrackerPage`, where they originally lived) - a real bug found via
 * Phase 5 step 14's e2e golden path, not caught by any unit test: Maps'
 * `useMapsStore` reads `useProgressTrackerStore.getState().activeProfileId`
 * imperatively as a cross-feature scoping key (see `features/maps/store.ts`),
 * but a real browser navigation to `/maps` (a full page load, not an
 * in-app client-side transition) starts with a fresh JS runtime - if
 * Progress Tracker's store only ever hydrated while `ProgressTrackerPage`
 * itself was mounted, landing directly on `/maps` (a bookmark, a reload, a
 * fresh tab) would see `activeProfileId: null` even with a real profile
 * already in `localStorage`, silently breaking every per-profile Maps
 * feature (annotations, task-display overrides) until the user happened to
 * separately visit `/progress-tracker` in the same session. Since every
 * other feature that reads active-profile state now has to assume it's
 * already hydrated, hydration (and its write-side counterpart) needed to
 * become a genuine app-wide concern, not a Progress-Tracker-page-scoped one
 * - the same tier Maps' OWN local persistence stays out of, since nothing
 * outside Maps itself reads `useMapsStore`.
 *
 * The query client is created inside `useState` rather than as a
 * module-level singleton so each request gets its own instance during SSR,
 * preventing data from leaking between users. The persister is created the
 * same way for the same reason.
 *
 * `PersistQueryClientProvider` (not `QueryClientProvider`) persists the
 * query cache to `localStorage`, replicating legacy's `refreshData.js`
 * instant-reload-from-cache UX (its hand-rolled fetch + manual
 * localStorage cache existed specifically so the site didn't block on a
 * network round-trip every visit). It renders its own `QueryClientProvider`
 * internally, so it replaces that component rather than wrapping it. Uses
 * `@tanstack/query-async-storage-persister`, not the more
 * obviously-named `@tanstack/query-sync-storage-persister` - verified
 * directly against the installed package source that
 * `createSyncStoragePersister` carries a real `@deprecated` JSDoc tag
 * pointing at the async variant; a plain synchronous `window.localStorage`
 * is structurally assignable to `AsyncStorage<T>` (whose methods return
 * `T | Promise<T>`), so this introduces no actual async I/O. Verified
 * end-to-end against a production build + the real live tarkov.dev API:
 * first load fetches and populates correctly, the cache is written to
 * `localStorage` as plain JSON, and a reload renders instantly from that
 * cache (~130ms) before any network refetch.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Game data changes with wipes/patches, not minute-to-minute -
            // a long staleTime avoids redundant refetches on every mount.
            staleTime: 60 * 60 * 1000,
          },
        },
      }),
  );
  const [persister] = useState(() =>
    createAsyncStoragePersister({
      storage: typeof window === "undefined" ? undefined : window.localStorage,
      key: QUERY_CACHE_STORAGE_KEY,
    }),
  );

  useHydrateOnMount();
  usePersistenceSync();

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, buster: QUERY_CACHE_BUSTER, maxAge: QUERY_CACHE_MAX_AGE_MS }}
    >
      <ThemeProvider>
        <TooltipProvider>
          {children}
          <Toaster />
          <DetailDialogsLazy />
          {/* Device sync's own Liveblocks room - separate client, room
              namespace (`sync:`) and API route from the maps Collaborate
              session (`maps:`), so the two never interfere. */}
          <DeviceSyncRoomProvider>
            <CompanionAutoLauncher />
          </DeviceSyncRoomProvider>
        </TooltipProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  );
}
