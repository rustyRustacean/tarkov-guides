"use client";

import { useEffect, useState } from "react";

import { toast } from "@/shared/ui/toast/toast-store";

import {
  fsaFolderAdapter,
  getLinkStatus,
  pickAndLink,
  requestReconnect,
  resolveConflict as resolveConflictWithAdapter,
  unlink as unlinkAdapter,
} from "../persistence/fsa-folder-adapter";
import { serializeSnapshot } from "../persistence/serialize";
import { useProgressTrackerStore } from "../store";

import type { FsaFolderStatus } from "../persistence/fsa-folder-adapter";
import type { ProgressTrackerSnapshot } from "../persistence/types";

export interface UseFsaFolderLinkResult {
  isSupported: boolean;
  status: FsaFolderStatus | null;
  /** Non-null while a link-time conflict needs a Replace/Keep-local decision (see `pickAndLink`'s `"conflict"` result). */
  pendingConflict: ProgressTrackerSnapshot | null;
  link: () => Promise<void>;
  resolveConflict: (choice: "replace" | "keep-local") => Promise<void>;
  unlinkFolder: () => Promise<void>;
  reconnect: () => Promise<void>;
}

/**
 * UI-facing wiring for the Tier 2 (FSA folder) backup's link/conflict/status
 * flow, mirroring `use-backup-restore.ts`'s style. `status`/`pendingConflict`
 * are local component state rather than the Zustand store: an adapter's own
 * link status is a UI-local concern (the store's `syncSource`/`lastSyncedAt`
 * are reserved for a future companion-sync feature).
 */
export function useFsaFolderLink(): UseFsaFolderLinkResult {
  const [status, setStatus] = useState<FsaFolderStatus | null>(null);
  const [pendingConflict, setPendingConflict] = useState<ProgressTrackerSnapshot | null>(null);

  useEffect(() => {
    // Skip when the FSA API isn't supported (Firefox/Safari): no linked
    // folder to check, and no reason to touch IndexedDB on this tier.
    if (!fsaFolderAdapter.isAvailable()) return undefined;

    let cancelled = false;

    async function loadStatus(): Promise<void> {
      const current = await getLinkStatus();
      if (!cancelled) setStatus(current);
    }
    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshStatus(): Promise<void> {
    setStatus(await getLinkStatus());
  }

  async function link(): Promise<void> {
    const localSnapshot = serializeSnapshot(useProgressTrackerStore.getState());
    const result = await pickAndLink(localSnapshot);

    switch (result.status) {
      case "linked":
        await refreshStatus();
        toast({ message: "Backup folder linked" });
        break;
      case "restored":
        useProgressTrackerStore.getState().hydrate(result.snapshot);
        await refreshStatus();
        toast({ message: "Backup folder linked - existing backup restored" });
        break;
      case "conflict":
        setPendingConflict(result.folderSnapshot);
        break;
      case "cancelled":
        break;
    }
  }

  async function resolveConflict(choice: "replace" | "keep-local"): Promise<void> {
    if (!pendingConflict) return;
    const localSnapshot = serializeSnapshot(useProgressTrackerStore.getState());
    const result = await resolveConflictWithAdapter(choice, pendingConflict, localSnapshot);
    setPendingConflict(null);

    if (result) {
      useProgressTrackerStore.getState().hydrate(result);
      toast({ message: "Replaced with the folder's backup" });
    } else {
      toast({ message: "Kept local progress - folder overwritten" });
    }
    await refreshStatus();
  }

  async function unlinkFolder(): Promise<void> {
    await unlinkAdapter();
    setStatus(null);
    toast({ message: "Backup folder unlinked" });
  }

  async function reconnect(): Promise<void> {
    const granted = await requestReconnect();
    await refreshStatus();
    toast({ message: granted ? "Reconnected to backup folder" : "Reconnect failed" });
  }

  return {
    isSupported: fsaFolderAdapter.isAvailable(),
    status,
    pendingConflict,
    link,
    resolveConflict,
    unlinkFolder,
    reconnect,
  };
}
