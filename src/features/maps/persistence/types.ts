import type { CustomMapEntry, MapProfileState } from "../types";

/**
 * The one canonical persisted shape for the Maps feature - own snapshot,
 * own localStorage key, entirely independent of Progress Tracker's
 * `ProgressTrackerSnapshot`/backup-restore. Follows the same "define the
 * field list exactly once" discipline that module's own doc comment
 * documents the cost of skipping (legacy's `persistence.js` hand-duplicated
 * its field list in 4+ places and silently drifted - `hideoutGoal`/
 * `mapVariants` were saved to localStorage but missing from both backup
 * payloads).
 */
export interface MapsSnapshot {
  schemaVersion: 1;
  exportedAt: string;
  currentMap: string;
  /** mapNormalizedName -> custom variant metadata (shared across profiles, matches legacy). Image bytes live in IndexedDB, see `idb.ts`. */
  customMaps: Readonly<Record<string, readonly CustomMapEntry[]>>;
  /** profileId -> per-profile Maps state (annotations, task-display overrides). */
  profileState: Readonly<Record<string, MapProfileState>>;
  /** The Valuables panel's "Top Dollar" price cutoff, in roubles - shared across profiles, matches legacy's single flat `state.topDollarThreshold`. */
  topDollarThresholdRub: number;
}

/**
 * A backend capable of persisting/restoring a {@link MapsSnapshot}. Mirrors
 * `src/features/progress-tracker/persistence/types.ts`'s `PersistenceAdapter`
 * exactly (arrow-function properties, same reasoning: TS method shorthand
 * makes `@typescript-eslint/unbound-method` flag bare references like
 * `vi.mocked(adapter.write)` in tests).
 */
export interface MapsPersistenceAdapter {
  readonly id: "local-storage";
  isAvailable: () => boolean;
  write: (snapshot: MapsSnapshot) => Promise<void>;
  read: () => Promise<MapsSnapshot | null>;
}
