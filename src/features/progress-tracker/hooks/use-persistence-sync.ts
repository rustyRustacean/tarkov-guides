"use client";

import { useStorePersistenceSync } from "@/shared/lib/persistence/use-store-persistence-sync";

import { fsaFolderAdapter } from "../persistence/fsa-folder-adapter";
import { localStorageAdapter, STORAGE_KEY } from "../persistence/local-storage-adapter";
import { deserializeSnapshot, serializeSnapshot } from "../persistence/serialize";
import { isPersistenceSuspended } from "../persistence/suspend";
import { useProgressTrackerStore } from "../store";

/**
 * A stable (module-level) array reference for `extraWriters` - see
 * `useStorePersistenceSync`'s own doc comment for why this must not be a
 * fresh literal at the call site. `fsaFolderAdapter.write` no-ops
 * internally if no folder is linked, so this always-present entry is safe
 * even when Tier 2 isn't in use.
 */
const EXTRA_WRITERS = [fsaFolderAdapter];

/**
 * Keeps localStorage (Tier 1) - and, when linked, the FSA folder (Tier 2) -
 * in sync with the store, plus the cross-tab `storage`-event counterpart
 * that keeps two tabs open on the same profile from silently overwriting
 * each other. Built on the shared `useStorePersistenceSync` hook
 * (`CODE_AUDIT.md` finding 8) - see that module's own doc comment for the
 * full debounce/flush/cross-tab mechanics; this feature's own contribution
 * is its snapshot type, its two adapters, `STORAGE_KEY`, and `isSuspended`
 * (cross-device sync's viewer mode - see `persistence/suspend.ts`).
 */
export function usePersistenceSync(): void {
  useStorePersistenceSync({
    store: useProgressTrackerStore,
    adapter: localStorageAdapter,
    serialize: serializeSnapshot,
    deserialize: deserializeSnapshot,
    storageKey: STORAGE_KEY,
    extraWriters: EXTRA_WRITERS,
    // While viewing another device's progress (cross-device sync), the store
    // holds borrowed state - never write it over this browser's own save.
    isSuspended: isPersistenceSuspended,
  });
}
