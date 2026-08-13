/**
 * A global "don't persist anything right now" switch.
 *
 * Exists for cross-device sync's viewer mode: a joined device shows the host's
 * progress in the normal store (so every panel renders it without any of the
 * ~26 read sites needing to know), but that borrowed state must never reach
 * this browser's own saved data. Suspending writes means localStorage keeps
 * holding the viewer's REAL progress the whole time, so even a crash or a
 * closed tab mid-view is safe, and leaving the session just re-reads it.
 *
 * Deliberately a module-level flag rather than store state: it must be
 * readable from `usePersistenceSync`'s non-React subscribe/flush callbacks,
 * and it is never itself persisted or rendered.
 */
let suspended = false;

/** Suspend (or resume) all progress persistence. */
export function setPersistenceSuspended(value: boolean): void {
  suspended = value;
}

/** Whether progress writes are currently suspended. */
export function isPersistenceSuspended(): boolean {
  return suspended;
}
