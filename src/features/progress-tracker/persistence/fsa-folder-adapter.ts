"use client";

import { idbDel, idbGet, idbPut } from "./idb";
import { deserializeSnapshot } from "./serialize";

import type { PersistenceAdapter, ProgressTrackerSnapshot } from "./types";

const HANDLE_KEY = "backup-folder";
const AUTOSAVE_FILENAME = "tarkovguides-progress.json";

let cachedHandle: FileSystemDirectoryHandle | null = null;

async function getHandle(): Promise<FileSystemDirectoryHandle | null> {
  if (cachedHandle) return cachedHandle;
  const stored = await idbGet<FileSystemDirectoryHandle>(HANDLE_KEY);
  cachedHandle = stored ?? null;
  return cachedHandle;
}

/**
 * Checks (and if needed, best-effort re-requests) permission. Wrapped in a
 * try/catch because `requestPermission()` can throw outside a real user
 * gesture (e.g. called from the debounced auto-save flush rather than a
 * click handler); treated the same as "not granted." Ported from legacy's
 * `ensureFolderPerm`.
 */
async function ensurePermission(
  handle: FileSystemDirectoryHandle,
  mode: "read" | "readwrite",
): Promise<boolean> {
  try {
    if ((await handle.queryPermission({ mode })) === "granted") return true;
    if ((await handle.requestPermission({ mode })) === "granted") return true;
  } catch {
    // No user gesture available; fall through to `false`.
  }
  return false;
}

async function writeSnapshotToHandle(
  handle: FileSystemDirectoryHandle,
  snapshot: ProgressTrackerSnapshot,
): Promise<void> {
  const fileHandle = await handle.getFileHandle(AUTOSAVE_FILENAME, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(snapshot, null, 2));
  await writable.close();
}

/** Resolves `null` if there's no autosave file yet, or its contents are malformed; never throws, matching `manual-json-adapter.ts`'s `readJsonFile` contract. */
async function readSnapshotFromHandle(
  handle: FileSystemDirectoryHandle,
): Promise<ProgressTrackerSnapshot | null> {
  try {
    const fileHandle = await handle.getFileHandle(AUTOSAVE_FILENAME, { create: false });
    const file = await fileHandle.getFile();
    const parsed: unknown = JSON.parse(await file.text());
    return deserializeSnapshot(parsed);
  } catch {
    return null;
  }
}

export interface FsaFolderStatus {
  name: string;
  permission: PermissionState;
}

/** Read-only, mount-safe status check; never calls `requestPermission()` (no user gesture available at mount). Resolves `null` if no folder is linked. */
export async function getLinkStatus(): Promise<FsaFolderStatus | null> {
  const handle = await getHandle();
  if (!handle) return null;
  const permission = await handle
    .queryPermission({ mode: "readwrite" })
    .catch((): PermissionState => "prompt");
  return { name: handle.name, permission };
}

export type LinkResult =
  | { status: "linked" } // no existing folder backup: fresh link, current state written immediately
  | { status: "restored"; snapshot: ProgressTrackerSnapshot } // existing folder backup, local was empty: silently adopted
  | { status: "conflict"; folderSnapshot: ProgressTrackerSnapshot } // existing folder backup, local has real progress: needs a user decision
  | { status: "cancelled" }; // picker dismissed, unsupported browser, or a blocklisted root folder rejected

/**
 * Opens the native folder picker and links it as the Tier 2 backup target.
 * Must be called from a user gesture (a click handler): `showDirectoryPicker()`
 * requires transient activation. Ported from legacy's `pickBackupFolder`,
 * including its 3-branch conflict check, simplified to check only the fixed
 * autosave filename rather than scanning the whole folder for any
 * similarly-named file.
 */
export async function pickAndLink(
  currentLocalSnapshot: ProgressTrackerSnapshot,
): Promise<LinkResult> {
  if (typeof window === "undefined" || typeof window.showDirectoryPicker !== "function") {
    return { status: "cancelled" };
  }

  let handle: FileSystemDirectoryHandle;
  try {
    handle = await window.showDirectoryPicker({
      id: "tarkovguides-backup",
      mode: "readwrite",
      startIn: "documents",
    });
  } catch {
    // AbortError (user dismissed the picker) or a blocklisted root folder
    // (e.g. Documents itself): both are a silent "not linked" outcome.
    return { status: "cancelled" };
  }

  await idbPut(HANDLE_KEY, handle);
  cachedHandle = handle;

  const folderSnapshot = await readSnapshotFromHandle(handle);
  if (!folderSnapshot) {
    await writeSnapshotToHandle(handle, currentLocalSnapshot);
    return { status: "linked" };
  }
  if (currentLocalSnapshot.profiles.length === 0) {
    return { status: "restored", snapshot: folderSnapshot };
  }
  return { status: "conflict", folderSnapshot };
}

/**
 * Resolves a link-time conflict. `"replace"` returns the folder's snapshot
 * for the caller to `store.hydrate()`; `"keep-local"` overwrites the
 * folder's file with the current local state and returns `null`. Checks
 * permission first, same as {@link fsaFolderAdapter}'s `write`. This is
 * normally called immediately after `pickAndLink` grants it in the same
 * flow, but without the check, a permission that reverted in between would
 * throw from `writeSnapshotToHandle` instead of failing silently like every
 * other write path in this file.
 */
export async function resolveConflict(
  choice: "replace" | "keep-local",
  folderSnapshot: ProgressTrackerSnapshot,
  currentLocalSnapshot: ProgressTrackerSnapshot,
): Promise<ProgressTrackerSnapshot | null> {
  if (choice === "replace") return folderSnapshot;
  const handle = await getHandle();
  if (handle && (await ensurePermission(handle, "readwrite"))) {
    await writeSnapshotToHandle(handle, currentLocalSnapshot);
  }
  return null;
}

/** Unlinks the folder: clears the stored handle. The already-saved file is left in place, matching legacy's `unlinkBackupFolder`. */
export async function unlink(): Promise<void> {
  await idbDel(HANDLE_KEY);
  cachedHandle = null;
}

/** Re-requests permission from a fresh user gesture, for when a prior session's grant reverted to `"prompt"` (FSA permissions aren't guaranteed to persist across browser restarts). */
export async function requestReconnect(): Promise<boolean> {
  const handle = await getHandle();
  if (!handle) return false;
  try {
    return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
  } catch {
    return false;
  }
}

/**
 * Tier 2 of the three-tier backup architecture: continuous auto-save to a
 * user-linked local folder (Chrome/Edge only, feature-detected). Unlike
 * Tier 1 (`local-storage-adapter.ts`) and Tier 3 (`manual-json-adapter.ts`),
 * this adapter also exposes {@link getLinkStatus}/{@link pickAndLink}/
 * {@link resolveConflict}/{@link unlink}/{@link requestReconnect} beyond the
 * base `PersistenceAdapter` contract, since the link/conflict/status UI flow
 * doesn't fit the generic 3-tier `write`/`read` shape.
 */
export const fsaFolderAdapter: PersistenceAdapter = {
  id: "fsa-folder",

  isAvailable() {
    return typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";
  },

  async write(snapshot) {
    const handle = await getHandle();
    if (!handle) return;
    const granted = await ensurePermission(handle, "readwrite");
    if (!granted) return;
    await writeSnapshotToHandle(handle, snapshot);
  },

  async read() {
    const handle = await getHandle();
    if (!handle) return null;
    return readSnapshotFromHandle(handle);
  },
};
