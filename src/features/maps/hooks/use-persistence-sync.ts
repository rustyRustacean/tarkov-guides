"use client";

import { useStorePersistenceSync } from "@/shared/lib/persistence/use-store-persistence-sync";

import { localStorageAdapter, STORAGE_KEY } from "../persistence/local-storage-adapter";
import { deserializeSnapshot, serializeSnapshot } from "../persistence/serialize";
import { useMapsStore } from "../store";

/**
 * Keeps localStorage in sync with `useMapsStore`, via the shared
 * `useStorePersistenceSync` hook (`CODE_AUDIT.md` finding 8) - see that
 * module's own doc comment for the full debounce/flush/cross-tab
 * mechanics. No `extraWriters` (this feature has no FSA-folder tier,
 * unlike `progress-tracker`'s own use of this same hook).
 *
 * Gains the cross-tab `storage`-event protection here for the first time -
 * before this consolidation, Maps' own hand-rolled version of this hook
 * lacked it entirely (only `progress-tracker`'s had it), so two tabs open
 * on the same profile could silently overwrite each other's map
 * annotations/task-display overrides. Passing `storageKey` is what enables
 * it in the shared hook.
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
