import { createLocalStorageAdapter } from "@/shared/lib/persistence/create-local-storage-adapter";

import { deserializeSnapshot } from "./serialize";

/**
 * New namespace (never the legacy site's state key), matching the
 * `.v1` localStorage-key convention. Exported so `use-persistence-sync.ts`'s
 * cross-tab `storage` event listener can filter to exactly this key without
 * a second, driftable copy of the string.
 */
export const STORAGE_KEY = "tarkovguides.progress-tracker.v1";

/**
 * Tier 1 of the three-tier backup architecture: always-on, the sole
 * source of truth for "what does the user see on next visit." Built on the
 * shared `createLocalStorageAdapter` factory; see that module's own doc
 * comment for the write-failure/read-failure contract.
 */
export const localStorageAdapter = createLocalStorageAdapter(
  STORAGE_KEY,
  "progress-tracker",
  deserializeSnapshot,
);
