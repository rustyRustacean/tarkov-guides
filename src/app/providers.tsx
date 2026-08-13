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

/** localStorage key the persisted query cache is written under. Bump the trailing version if `TarkovGameData`'s shape ever changes in a breaking way; see `QUERY_CACHE_BUSTER` below, the idiomatic replacement for legacy's ad hoc schema-migration checks. */
const QUERY_CACHE_STORAGE_KEY = "tarkovguides.query-cache.v1";
/**
 * Passed as `persistOptions.buster`: bump this string (not the storage key
 * above) whenever a cached query's shape changes in a breaking way, or the
 * underlying data source changes such that persisted values could no longer
 * match what the app expects. React Query discards a persisted cache whose
 * buster doesn't match, so a returning visitor's browser won't render stale
 * or mismatched cached data until its normal TTL would have lapsed.
 */
const QUERY_CACHE_BUSTER = "v4";
/** Hard cutoff for a persisted cache's age, matching legacy's `refreshData.js` 24h localStorage TTL. Distinct from `staleTime` below: this deletes stale data outright, staleTime only governs background revalidation. */
const QUERY_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Wraps the app with every app-wide React context provider: TanStack Query
 * (all remote/server data, primarily the tarkov.dev API, see
 * `src/shared/lib/tarkov-api`), the design system's `ThemeProvider`, a
 * single Radix `TooltipProvider` (Radix requires exactly one, shared by
 * every `Tooltip` instance in the tree; do not mount another one
 * per-component), and the single `Toaster` that renders whatever the
 * imperative `toast()` API (`shared/ui/toast/toast-store`) triggers.
 * Client-only domain state with no server counterpart (user progress, etc.)
 * is handled separately via Zustand stores.
 *
 * Progress Tracker's own hydrate-on-mount/persistence-sync hooks are wired
 * in here rather than inside `ProgressTrackerPage`: Maps' `useMapsStore`
 * reads `useProgressTrackerStore.getState().activeProfileId` imperatively
 * as a cross-feature scoping key (see `features/maps/store.ts`), so a
 * direct browser navigation to `/maps` (a bookmark, a reload, a fresh tab)
 * needs that store already hydrated regardless of whether
 * `ProgressTrackerPage` was ever mounted this session. Hydration therefore
 * has to be a genuine app-wide concern, unlike Maps' own local persistence,
 * which nothing outside Maps reads.
 *
 * The query client and persister are created inside `useState` rather than
 * as module-level singletons so each request gets its own instance during
 * SSR, preventing data from leaking between users.
 *
 * `PersistQueryClientProvider` (not `QueryClientProvider`) persists the
 * query cache to `localStorage`, replicating legacy's instant-reload-from-
 * cache UX. It renders its own `QueryClientProvider` internally, so it
 * replaces that component rather than wrapping it. Uses
 * `@tanstack/query-async-storage-persister`, not the more obviously-named
 * `@tanstack/query-sync-storage-persister`: the sync variant's
 * `createSyncStoragePersister` carries a `@deprecated` JSDoc tag pointing
 * at the async one. A plain synchronous `window.localStorage` is
 * structurally assignable to `AsyncStorage<T>` (whose methods return
 * `T | Promise<T>`), so this introduces no actual async I/O.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Game data changes with wipes/patches, not minute-to-minute;
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
          {/* Device sync's own Liveblocks room: separate client, room
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
