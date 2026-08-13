import type { CustomMapEntry, MapProfileState } from "../types";
import type { PersistenceAdapter as SharedPersistenceAdapter } from "@/shared/lib/persistence/types";

/**
 * The one canonical persisted shape for the Maps feature: own snapshot, own
 * localStorage key, independent of Progress Tracker's
 * `ProgressTrackerSnapshot`/backup-restore. Field list defined exactly once
 * on purpose; legacy's `persistence.js` hand-duplicated its field list in
 * 4+ places and silently drifted (`hideoutGoal`/`mapVariants` were saved to
 * localStorage but missing from both backup payloads).
 */
export interface MapsSnapshot {
  schemaVersion: 1;
  exportedAt: string;
  currentMap: string;
  /** mapNormalizedName -> custom variant metadata (shared across profiles, matches legacy). Image bytes live in IndexedDB, see `idb.ts`. */
  customMaps: Readonly<Record<string, readonly CustomMapEntry[]>>;
  /** profileId -> per-profile Maps state (annotations, task-display overrides). */
  profileState: Readonly<Record<string, MapProfileState>>;
  /** The Valuables panel's "Top Dollar" price cutoff, in roubles. Shared across profiles, matching legacy's single flat `state.topDollarThreshold`. */
  topDollarThresholdRub: number;
}

/**
 * A backend capable of persisting/restoring a {@link MapsSnapshot}. Narrows
 * the shared `PersistenceAdapter<TSnapshot>` to this feature's
 * single-backend `id` (Maps has no FSA-folder/manual-JSON tier, unlike
 * Progress Tracker's narrowing in `progress-tracker/persistence/types.ts`).
 */
export interface MapsPersistenceAdapter extends Omit<SharedPersistenceAdapter<MapsSnapshot>, "id"> {
  readonly id: "local-storage";
}
