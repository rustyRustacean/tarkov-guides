import type { Profile, ProfileMode, ProfileModeKey, ProfileProgress } from "../types";
import type { PersistenceAdapter as SharedPersistenceAdapter } from "@/shared/lib/persistence/types";

/**
 * The one canonical persisted shape, reused identically by every backend
 * (localStorage, the File System Access folder adapter, and manual JSON
 * export/import). Legacy's `persistence.js` independently hand-listed this
 * same field set in at least 4 separate places (the localStorage save-slice
 * builder, the folder-autosave payload, the manual-export payload, and the
 * wipe function's manual patch), and they'd already drifted out of sync in
 * the shipped app (`hideoutGoal`/`mapVariants` saved to localStorage but
 * omitted from both backup payloads, silently losing the hideout goal on
 * restore). Never hand-duplicate this field list again.
 *
 * `schemaVersion` stays `1` forever; there is no version-bump migration
 * path (`deserializeSnapshot` rejects wholesale on anything else). New
 * fields (e.g. `activeMode`, added for the game-mode rework) are backfilled
 * in place during deserialization instead, same convention as
 * `prestigeLevel`'s `withPrestigeLevelBackfill`.
 */
export interface ProgressTrackerSnapshot {
  schemaVersion: 1;
  exportedAt: string;
  profiles: readonly Profile[];
  activeProfileId: string | null;
  /** Site-wide selected mode; see `ProgressTrackerState.activeMode`. */
  activeMode: ProfileMode;
  progressByProfile: Readonly<Record<ProfileModeKey, ProfileProgress>>;
  autoStartNext: boolean;
}

/**
 * A backend capable of persisting/restoring a {@link ProgressTrackerSnapshot}.
 * Narrows the shared `PersistenceAdapter<TSnapshot>` (`shared/lib/persistence`)
 * to this feature's own 3-backend `id` union, since `maps` supports a
 * different, smaller set.
 */
export interface PersistenceAdapter extends Omit<
  SharedPersistenceAdapter<ProgressTrackerSnapshot>,
  "id"
> {
  readonly id: "local-storage" | "fsa-folder" | "manual-json";
}
