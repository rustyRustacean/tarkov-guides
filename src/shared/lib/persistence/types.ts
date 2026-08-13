/**
 * A backend capable of persisting/restoring a snapshot of type `TSnapshot`.
 * Generalized from `progress-tracker`/`maps`'s two structurally-identical
 * `PersistenceAdapter` interfaces; each feature still declares its own
 * narrower type extending this with a concrete `id` union (e.g.
 * `"local-storage" | "fsa-folder" | "manual-json"`), since the two features
 * support different backend sets.
 *
 * Declared with arrow-function properties, not TS method shorthand: method
 * shorthand makes `@typescript-eslint/unbound-method` flag any bare
 * reference to e.g. `adapter.write` (as this project's adapter tests do,
 * via `vi.mocked(...)`/`expect(...)`).
 */
export interface PersistenceAdapter<TSnapshot> {
  readonly id: string;
  /** Whether this backend can run in the current browser (e.g. File System Access support). */
  isAvailable: () => boolean;
  write: (snapshot: TSnapshot) => Promise<void>;
  /** Resolves `null` if there's nothing to read yet (first visit) or the stored data is unreadable/malformed. Never throws. */
  read: () => Promise<TSnapshot | null>;
}
