import type { Profile, ProfileProgress } from "../types";
import type { PersistenceAdapter as SharedPersistenceAdapter } from "@/shared/lib/persistence/types";

/**
 * The one canonical persisted shape, reused identically by every backend
 * (localStorage, the File System Access folder adapter, and manual JSON
 * export/import). Legacy's `persistence.js` independently hand-lists this
 * same field set in at least 4 separate places (the localStorage save-slice
 * builder, the folder-autosave payload, the manual-export payload, and the
 * wipe function's manual patch) - confirmed already out of sync in the
 * shipped app (`hideoutGoal`/`mapVariants` are saved to localStorage but
 * omitted from both backup payloads, silently losing the hideout goal on
 * restore). Never hand-duplicate this field list again.
 */
export interface ProgressTrackerSnapshot {
  schemaVersion: 1;
  exportedAt: string;
  profiles: readonly Profile[];
  activeProfileId: string | null;
  progressByProfile: Readonly<Record<string, ProfileProgress>>;
  autoStartNext: boolean;
}

/**
 * A backend capable of persisting/restoring a {@link ProgressTrackerSnapshot} -
 * narrows the shared `PersistenceAdapter<TSnapshot>` (`shared/lib/persistence`)
 * to this feature's own 3-backend `id` union, since `maps` supports a
 * different, smaller set.
 */
export interface PersistenceAdapter extends Omit<
  SharedPersistenceAdapter<ProgressTrackerSnapshot>,
  "id"
> {
  readonly id: "local-storage" | "fsa-folder" | "manual-json";
}
