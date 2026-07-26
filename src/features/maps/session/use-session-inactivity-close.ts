"use client";

import { useEffect, useRef } from "react";

import { useStorage } from "./liveblocks-config";

export const SESSION_INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour
const CHECK_INTERVAL_MS = 60 * 1000; // a 1-minute check granularity is plenty for an hour-long threshold

/**
 * Calls `onTimeout` once a collaborative session has gone this long with no
 * shared activity - a safeguard for sessions left open and forgotten, on top
 * of (not instead of) Liveblocks' own passive inactivity cleanup, which
 * isn't precisely timed or under this app's control (see the plan's
 * reasoning on why the explicit `/api/maps-session/end` route is the
 * primary expiry mechanism). "Activity" is any storage change at all -
 * selecting the whole root (not one field) so a map/variant switch, a pan/
 * zoom broadcast, or a stroke all reset the clock, not just whichever field
 * this hook happens to name.
 *
 * `active` gates the whole hook - pass `false` (not just skip calling this)
 * when there's no session or the caller isn't the host, since only the
 * host's `/api/maps-session/end` call actually succeeds (see that route's
 * host-only check) - this hook doesn't re-check that itself.
 */
export function useSessionInactivityClose(
  active: boolean,
  onTimeout: () => void,
  timeoutMs: number = SESSION_INACTIVITY_TIMEOUT_MS,
): void {
  const storageSnapshot = useStorage((root) => root);

  const onTimeoutRef = useRef(onTimeout);
  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  });

  // Initialized to `0` (not `Date.now()`) so this stays a pure render - the
  // very first run of the effect below (which fires on mount, since `active`/
  // `storageSnapshot` are already set by then) is what actually records the
  // real starting timestamp.
  const lastActivityRef = useRef(0);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    lastActivityRef.current = Date.now();
  }, [active, storageSnapshot]);

  useEffect(() => {
    if (!active) return;
    firedRef.current = false;
    const interval = setInterval(() => {
      if (firedRef.current) return;
      if (Date.now() - lastActivityRef.current >= timeoutMs) {
        firedRef.current = true;
        onTimeoutRef.current();
      }
    }, CHECK_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, [active, timeoutMs]);
}
