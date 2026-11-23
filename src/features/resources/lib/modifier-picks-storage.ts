import { useMemo, useSyncExternalStore } from "react";

/**
 * The reader's modifier picks, kept in `localStorage` so a plan survives a
 * reload. Read through `useSyncExternalStore` (the storage is the source of
 * truth, not React state), with an in-memory copy so picking still works
 * when storage is blocked (private windows, disabled site data). The server
 * snapshot is empty, so the first render matches the server's.
 */
const listeners = new Set<() => void>();
const memory = new Map<string, string>();

function readRaw(key: string): string {
  const cached = memory.get(key);
  if (cached !== undefined) return cached;
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab saved: drop this tab's cached copy so the new value is read.
  const onStorage = (event: StorageEvent) => {
    if (event.key) memory.delete(event.key);
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Keeps each id in `validIds` once, in its first position. Shared by saved picks and share links. */
export function keepValidIds(
  ids: readonly unknown[],
  validIds: ReadonlySet<string>,
): readonly string[] {
  return [...new Set(ids)].filter((id): id is string => typeof id === "string" && validIds.has(id));
}

/** Parses stored picks, keeping only ids in `validIds`, in their stored order. */
export function parsePicks(raw: string, validIds: ReadonlySet<string>): readonly string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return keepValidIds(parsed, validIds);
  } catch {
    return [];
  }
}

/** Saves the picks under `key` and tells every reader. */
export function savePicks(key: string, ids: readonly string[]): void {
  const raw = JSON.stringify(ids);
  memory.set(key, raw);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // Storage blocked: the in-memory copy keeps the planner working this visit.
  }
  for (const listener of listeners) listener();
}

/** The saved picks under `key`, filtered to `validIds`. */
export function usePicks(key: string, validIds: ReadonlySet<string>): readonly string[] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => "",
  );
  return useMemo(() => parsePicks(raw, validIds), [raw, validIds]);
}
