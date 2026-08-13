import { createLocalStorageAdapter } from "@/shared/lib/persistence/create-local-storage-adapter";

import { deserializeSnapshot } from "./serialize";

/** Own namespace, independent of Progress Tracker's `.v1` key (per-feature key convention). Exported so `use-persistence-sync.ts`'s cross-tab `storage` listener can filter to this key. */
export const STORAGE_KEY = "tarkovguides.maps.v1";

/**
 * The sole persistence backend for the Maps feature. Built on the shared
 * `createLocalStorageAdapter` factory; see that module's doc comment for
 * the write-failure/read-failure contract.
 */
export const localStorageAdapter = createLocalStorageAdapter(
  STORAGE_KEY,
  "maps",
  deserializeSnapshot,
);
