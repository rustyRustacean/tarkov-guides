"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import {
  COMPANION_AUTOLAUNCH_KEY,
  COMPANION_EVER_CONNECTED_KEY,
  COMPANION_KILLER_LOOKUP_KEY,
  COMPANION_LAUNCH_URL,
  COMPANION_MAP_FOLLOW_KEY,
  COMPANION_POLL_INTERVAL_MS,
  COMPANION_REQUEST_TIMEOUT_MS,
  COMPANION_PORT,
  COMPANION_PORTS,
  companionStatusUrl,
  isValidCompanionStatus,
  normalizeCompanionMode,
  type CompanionStatus,
} from "./companion-config";

const COMPANION_QUERY_KEY = ["companion", "status"] as const;

/** The port that last answered, tried first so the steady state stays one request. */
let lastGoodPort: number = COMPANION_PORT;

/**
 * Fetch the companion's status from localhost. Returns `null` for every
 * failure mode (not installed, not running, timeout, bad payload): a down
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
    // Try the port that answered last time first, then the rest in order, so
    // the normal case is still a single request and only a machine that had to
    // fall back ever pays for extra probes.
    const ports = [lastGoodPort, ...COMPANION_PORTS.filter((port) => port !== lastGoodPort)];
    for (const port of ports) {
      try {
        const response = await fetch(companionStatusUrl(port), {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) continue;
        const data: unknown = await response.json();
        if (!isValidCompanionStatus(data)) continue;
        lastGoodPort = port;
        // Validated once here so every consumer can trust the union. The wire
        // value is whatever the installed companion version emits (an old one
        // passes the game's raw "PvpSeason" token straight through).
        // `raidLocation` defaults to null for a companion old enough to
        // predate the field entirely (the validator above accepts it missing;
        // this is what makes that promise real for every reader downstream).
        return {
          ...data,
          mode: normalizeCompanionMode(data.mode),
          raidLocation: data.raidLocation ?? null,
        };
      } catch {
        // This port isn't it (nothing listening, or something that isn't us).
        if (controller.signal.aborted) return null;
      }
    }
    return null;
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

/*
 * One shared Worker (public/companion-tick-worker.js) that keeps ticking at
 * full cadence while the tab is hidden - Chrome throttles main-thread timers
 * in background tabs to ~once a minute, and the tab is ALWAYS hidden when it
 * matters because the player is tabbed into the game. Worker timers are
 * exempt, so this is what makes positions keep flowing mid-raid instead of
 * crawling. Refcounted across every `useCompanionStatus` observer so the app
 * holds at most one worker, torn down when the last observer unmounts.
 * Missing Worker support (SSR, jsdom) or a failed construction degrades to
 * the plain TanStack interval - slower in background, never broken.
 */
const tickerCallbacks = new Set<() => void>();
let tickerWorker: Worker | null = null;

function acquireBackgroundTicker(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof Worker === "undefined") return () => undefined;
  tickerCallbacks.add(callback);
  if (tickerWorker === null) {
    try {
      tickerWorker = new Worker("/companion-tick-worker.js");
      tickerWorker.postMessage(COMPANION_POLL_INTERVAL_MS);
      tickerWorker.onmessage = () => {
        tickerCallbacks.forEach((tick) => {
          tick();
        });
      };
    } catch {
      tickerWorker = null;
    }
  }
  return () => {
    tickerCallbacks.delete(callback);
    if (tickerCallbacks.size === 0 && tickerWorker !== null) {
      tickerWorker.terminate();
      tickerWorker = null;
    }
  };
}

/**
 * Poll the companion while `enabled` is true. All observers share one query
 * key, so the header button and the app-wide auto-launch hook dedupe into a
 * single localhost poll rather than two.
 */
export function useCompanionStatus(enabled: boolean): CompanionStatusResult {
  const queryClient = useQueryClient();
  // Worker-driven refetch for hidden tabs only: in a visible tab the query's
  // own refetchInterval already runs at full cadence, and skipping it here
  // keeps the two schedules from doubling up. `cancelRefetch: false` makes a
  // tick that lands mid-fetch reuse the in-flight request instead of
  // restarting it.
  useEffect(() => {
    if (!enabled) return;
    return acquireBackgroundTicker(() => {
      if (document.visibilityState !== "hidden") return;
      void queryClient.refetchQueries(
        { queryKey: COMPANION_QUERY_KEY, type: "active" },
        { cancelRefetch: false },
      );
    });
  }, [enabled, queryClient]);

  const query = useQuery({
    queryKey: COMPANION_QUERY_KEY,
    queryFn: ({ signal }) => fetchCompanionStatus(signal),
    enabled,
    refetchInterval: enabled ? COMPANION_POLL_INTERVAL_MS : false,
    // Keep polling while the tab is hidden, which it ALWAYS is when it
    // matters, because the player is tabbed into the game. The default
    // (pause in background) meant a raiding player's position only refreshed
    // on alt-tab, and after 10 unfocused minutes the un-polled companion
    // idle-exited entirely, going dark mid-raid. The browser throttles
    // hidden-tab timers to about once a minute, so this alone is only the
    // fallback cadence: the worker ticker above is what keeps hidden-tab
    // polls at full speed (worker timers aren't throttled).
    refetchIntervalInBackground: true,
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
 *
 * Gated on `everConnected`, the same evidence `useCompanionAutoLaunch` uses to
 * decide the protocol hand-off is safe to fire. Without it, this would poll
 * localhost for every visitor the moment they open a map: any fetch to
 * localhost from a public page trips Chromium's "Apps" / local-network
 * permission prompt, so a visitor who has never touched the companion feature
 * would get an unsolicited "wants to access other apps and services on this
 * device" popup just from viewing a map. Requiring prior evidence means the
 * prompt only ever follows something the visitor actually opted into
 * (enabling auto-launch, or opening the companion panel and connecting).
 */
export function useCompanionPosition() {
  const [everConnected] = useEverConnected();
  const { status } = useCompanionStatus(everConnected);
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

/** Map-follow preference (default OFF - see {@link COMPANION_MAP_FOLLOW_KEY}). */
export function useMapFollowPreference(): [boolean, (value: boolean) => void] {
  return useBooleanPreference(COMPANION_MAP_FOLLOW_KEY, false);
}

/**
 * Auto-launch preference (default off; opt-in only, via the checkbox). The
 * wscript.exe hand-off pops an OS-level "open this application?" dialog the
 * first time it fires for a given browser/origin, and that should only ever
 * happen because the user explicitly opted in.
 */
export function useAutoLaunchPreference(): [boolean, (value: boolean) => void] {
  return useBooleanPreference(COMPANION_AUTOLAUNCH_KEY, false);
}

/** "Profile search (Win+Shift+S)" preference (default OFF - see {@link COMPANION_KILLER_LOOKUP_KEY}). */
export function useKillerLookupPreference(): [boolean, (value: boolean) => void] {
  return useBooleanPreference(COMPANION_KILLER_LOOKUP_KEY, false);
}

/**
 * Whether a companion has ever answered on this machine. Not a user
 * setting; it's remembered evidence, gating the hand-off so a visitor who
 * has never installed anything never fires the protocol even if they turn
 * auto-launch on. Starts false.
 *
 * Exported so every app-wide companion hook, not just this file's own
 * `useCompanionAutoLaunch`, can require the same evidence before polling.
 * `useCompanionStatus` itself can't enforce this: `CompanionButton`
 * legitimately polls on-demand (dialog open) before any evidence exists,
 * since opening the panel *is* how a first-time user discovers and connects
 * the companion.
 */
export function useEverConnected(): [boolean, (value: boolean) => void] {
  return useBooleanPreference(COMPANION_EVER_CONNECTED_KEY, false);
}

/** How long to wait for a protocol hand-off to produce a live companion. */
const LAUNCH_GRACE_MS = 20_000;

export function useCompanionAutoLaunch(): void {
  const [enabled] = useAutoLaunchPreference();
  const [everConnected, setEverConnected] = useEverConnected();
  const { isConnected, hasChecked } = useCompanionStatus(enabled && everConnected);
  const launchedRef = useRef(false);

  // Mirrors the live value for the grace-period timer below, which fires long
  // after the effect that scheduled it closed over its arguments.
  const connectedRef = useRef(isConnected);
  useEffect(() => {
    connectedRef.current = isConnected;
  }, [isConnected]);

  // Any successful poll is the evidence. Recorded however the companion got
  // started: the installer, the "Start it" link, or a previous auto-launch.
  useEffect(() => {
    if (isConnected && !everConnected) setEverConnected(true);
  }, [isConnected, everConnected, setEverConnected]);

  useEffect(() => {
    if (!enabled) {
      launchedRef.current = false;
      return;
    }
    // Nothing has ever answered here, so there is nothing to re-launch and the
    // protocol would only summon the Store dialog.
    if (!everConnected) return;
    if (!hasChecked || isConnected || launchedRef.current) return;

    launchedRef.current = true;
    launchCompanion();

    // If the hand-off produced nothing, the handler is gone (uninstalled, or
    // a profile/machine change): forget the evidence so the next page load
    // is silent instead of popping the Store dialog again.
    const timer = window.setTimeout(() => {
      if (!connectedRef.current) setEverConnected(false);
    }, LAUNCH_GRACE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [enabled, everConnected, hasChecked, isConnected, setEverConnected]);
}
