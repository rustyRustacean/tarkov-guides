"use client";

import { toast } from "@/shared/ui/toast/toast-store";

import { manualJsonAdapter } from "../persistence/manual-json-adapter";
import { serializeSnapshot } from "../persistence/serialize";
import { useProgressTrackerStore } from "../store";

export interface UseBackupRestoreResult {
  exportBackup: () => void;
  /** Opens the native file picker; resolves once the flow completes (success, cancel, or bad file - all settle, never throw). */
  importBackup: () => Promise<void>;
  wipeProgress: () => void;
}

/**
 * Thin wiring between the already-built manual-JSON persistence adapter
 * (`persistence/manual-json-adapter.ts`) and the store, for
 * `BackupRestorePanel`. Not a `useUndoableState` consumer - Wipe/Import are
 * gated by their own `Dialog` confirmation instead of a toast-UNDO (see the
 * component's doc comment for why). No manual `localStorageAdapter` write is
 * needed after `hydrate`/`wipeActiveProgress`: both are plain store
 * mutations, so the already-mounted `usePersistenceSync`'s debounced
 * auto-save picks them up the same as any other change elsewhere in the app.
 */
export function useBackupRestore(): UseBackupRestoreResult {
  const hydrate = useProgressTrackerStore((state) => state.hydrate);
  const wipeActiveProgress = useProgressTrackerStore((state) => state.wipeActiveProgress);

  function exportBackup(): void {
    void manualJsonAdapter.write(serializeSnapshot(useProgressTrackerStore.getState()));
    toast({ message: "Backup exported" });
  }

  async function importBackup(): Promise<void> {
    const snapshot = await manualJsonAdapter.read();
    // A cancelled file picker and a malformed/wrong-shape file both resolve
    // `null` here - the adapter's contract can't distinguish them (see
    // `manual-json-adapter.ts`) - so this stays a silent no-op rather than
    // risk a false "Restore failed" toast on every mere cancel.
    if (!snapshot) return;
    hydrate(snapshot);
    toast({ message: "Backup restored" });
  }

  function wipeProgress(): void {
    wipeActiveProgress();
    toast({ message: "Progress wiped" });
  }

  return { exportBackup, importBackup, wipeProgress };
}
