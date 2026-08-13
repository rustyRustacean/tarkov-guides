"use client";

import { useStorePersistenceSync } from "@/shared/lib/persistence/use-store-persistence-sync";

import { localStorageAdapter, STORAGE_KEY } from "../persistence/local-storage-adapter";
import { deserializeSnapshot, serializeSnapshot } from "../persistence/serialize";
import { useMapsStore } from "../store";

/**
 * Keeps localStorage in sync with `useMapsStore`, via the shared
 * `useStorePersistenceSync` hook; see that module's own doc comment for the
 * full debounce/flush/cross-tab mechanics. No `extraWriters` (this feature
 * has no FSA-folder tier, unlike `progress-tracker`'s use of this same
 * hook).
 *
 * Passing `storageKey` enables cross-tab `storage`-event protection:
 * without it, two tabs open on the same profile could silently overwrite
 * each other's map annotations/task-display overrides.
 */
export function useMapsPersistenceSync(): void {
  useStorePersistenceSync({
    store: useMapsStore,
    adapter: localStorageAdapter,
    serialize: serializeSnapshot,
    deserialize: deserializeSnapshot,
    storageKey: STORAGE_KEY,
  });
}
