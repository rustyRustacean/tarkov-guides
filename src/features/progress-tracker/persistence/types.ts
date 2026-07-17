import type { Profile, ProfileProgress } from "../types";

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
 * A backend capable of persisting/restoring a {@link ProgressTrackerSnapshot}.
 * Declared with arrow-function property syntax, not TS method shorthand -
 * same reasoning as `store.ts`'s action interface (see its own comment):
 * method shorthand makes `@typescript-eslint/unbound-method` flag any bare
 * reference to e.g. `adapter.write` (as `fsa-folder-adapter.test.ts` and
 * `use-persistence-sync.test.ts` both do, via `vi.mocked(...)`/`expect(...)`).
 */
export interface PersistenceAdapter {
  readonly id: "local-storage" | "fsa-folder" | "manual-json";
  /** Whether this backend can run in the current browser (e.g. File System Access support). Always `true` for localStorage/manual-json. */
  isAvailable: () => boolean;
  write: (snapshot: ProgressTrackerSnapshot) => Promise<void>;
  /** Resolves `null` if there's nothing to read yet (first visit) or the stored data is unreadable/malformed - never throws. */
  read: () => Promise<ProgressTrackerSnapshot | null>;
}
