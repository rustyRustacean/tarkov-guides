"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import {
  COMPANION_AUTOLAUNCH_KEY,
  COMPANION_LAUNCH_URL,
  COMPANION_POLL_INTERVAL_MS,
  COMPANION_REQUEST_TIMEOUT_MS,
  COMPANION_STATUS_URL,
  type CompanionStatus,
} from "./companion-config";

const COMPANION_QUERY_KEY = ["companion", "status"] as const;

/**
 * Fetch the companion's status from localhost. Returns `null` for every
 * failure mode (not installed, not running, timeout, bad payload) - a down
 * companion is a normal state, not an error, so the UI treats "no data" as
 * "not connected" rather than surfacing a thrown error.
 */
export async function fetchCompanionStatus(signal?: AbortSignal): Promise<CompanionStatus | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, COMPANION_REQUEST_TIMEOUT_MS);
  const onAbort = () => {
    controller.abort();
  };
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await fetch(COMPANION_STATUS_URL, {
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = (await response.json()) as CompanionStatus | null;
    return data?.app ? data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

export interface CompanionStatusResult {
  status: CompanionStatus | null;
  isConnected: boolean;
  isChecking: boolean;
  hasChecked: boolean;
}

/**
 * Poll the companion while `enabled` is true. All observers share one query
 * key, so the header button and the app-wide auto-launch hook dedupe into a
 * single localhost poll rather than two.
 */
export function useCompanionStatus(enabled: boolean): CompanionStatusResult {
  const query = useQuery({
    queryKey: COMPANION_QUERY_KEY,
    queryFn: ({ signal }) => fetchCompanionStatus(signal),
    enabled,
    refetchInterval: enabled ? COMPANION_POLL_INTERVAL_MS : false,
    refetchOnWindowFocus: enabled,
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  const status = query.data ?? null;
  return {
    status,
    isConnected: status?.running ?? false,
    isChecking: query.isFetching && query.data === undefined,
    hasChecked: query.isFetched,
  };
}

/**
 * The latest player position from an in-raid screenshot, or null. Enables
 * companion polling while mounted (i.e. while the map is on screen); shares
 * the one status query with every other observer.
 */
export function useCompanionPosition() {
  const { status } = useCompanionStatus(true);
  return status?.position ?? null;
}

/**
 * Start the companion via its registered `masttarkov://` protocol. Navigating
 * a hidden iframe to the protocol hands off to the OS without leaving the page
 * or opening a visible tab; if the protocol isn't registered (not installed)
 * this is a harmless no-op.
 */
export function launchCompanion(): void {
  if (typeof window === "undefined") return;
  const frame = document.createElement("iframe");
  frame.style.display = "none";
  frame.src = COMPANION_LAUNCH_URL;
  document.body.appendChild(frame);
  window.setTimeout(() => {
    frame.remove();
  }, 1000);
}

function readBooleanPreference(key: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined") return defaultValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return defaultValue;
    return raw === "1";
  } catch {
    return defaultValue;
  }
}

function writeBooleanPreference(key: string, value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value ? "1" : "0");
  } catch {
    // Private-mode / disabled storage: preference simply doesn't persist.
  }
}

// Per-key same-tab subscribers (the `storage` event only fires in *other*
// tabs, so writes notify these listeners directly).
const preferenceListeners = new Map<string, Set<() => void>>();

function listenersFor(key: string): Set<() => void> {
  let set = preferenceListeners.get(key);
  if (!set) {
    set = new Set();
    preferenceListeners.set(key, set);
  }
  return set;
}

/**
 * A boolean preference backed by localStorage via `useSyncExternalStore`. The
 * server snapshot is `defaultValue`, so the first client paint matches SSR and
 * React reconciles to the stored value without a hydration mismatch (and
 * without a setState-in-effect).
 */
export function useBooleanPreference(
  key: string,
  defaultValue: boolean,
): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    (callback) => {
      const set = listenersFor(key);
      set.add(callback);
      return () => {
        set.delete(callback);
      };
    },
    () => readBooleanPreference(key, defaultValue),
    () => defaultValue,
  );

  const setValue = useCallback(
    (next: boolean) => {
      writeBooleanPreference(key, next);
      listenersFor(key).forEach((listener) => {
        listener();
      });
    },
    [key],
  );

  return [value, setValue];
}

/** Auto-launch preference (default off). */
export function useAutoLaunchPreference(): [boolean, (value: boolean) => void] {
  return useBooleanPreference(COMPANION_AUTOLAUNCH_KEY, false);
}

/**
 * App-wide side effect: keep the companion running from then on.
 *
 * Auto-launch starts off. The first time the companion is seen connected (i.e.
 * the user has installed it - the polling that detects this is driven by the
 * profile-sync observer, which is on by default), auto-launch turns itself on.
 * From that point every visit starts the companion if it isn't already up, so
 * "install once, it just runs" holds - while users who never install it never
 * trigger a launch. Reads the shared status cache, so it doesn't force its own
 * poll when disabled.
 */
export function useCompanionAutoLaunch(): void {
  const [enabled, setEnabled] = useAutoLaunchPreference();
  const { isConnected, hasChecked } = useCompanionStatus(enabled);
  const launchedRef = useRef(false);

  useEffect(() => {
    if (isConnected && !enabled) setEnabled(true);
  }, [isConnected, enabled, setEnabled]);

  useEffect(() => {
    if (!enabled) {
      launchedRef.current = false;
      return;
    }
    if (hasChecked && !isConnected && !launchedRef.current) {
      launchedRef.current = true;
      launchCompanion();
    }
  }, [enabled, hasChecked, isConnected]);
}
