"use client";

import { useSyncExternalStore } from "react";

import { tarkovClock } from "../lib/tarkov-clock";

const TICK_MS = 1000;

// `useSyncExternalStore`'s `getSnapshot` must return a value that's stable
// between calls until the store actually changes - React re-invokes it more
// than once per commit (StrictMode's double-render, plus its own tearing
// check) to verify that. Passing `Date.now` directly as `getSnapshot` (the
// original approach) fails that check - two calls microseconds apart can
// straddle a millisecond boundary and return different numbers, which
// surfaces as React's "The result of getSnapshot should be cached to avoid
// an infinite loop" console error. Caching the real time in this
// module-level variable, refreshed only from `subscribe`'s own tick (plus
// once synchronously on subscribe, so a fresh mount doesn't briefly show a
// stale value from a previous mount/import), keeps `getSnapshot` pure.
let cachedNow = Date.now();

function getSnapshot(): number {
  return cachedNow;
}

function subscribe(callback: () => void): () => void {
  cachedNow = Date.now();
  callback();
  const id = setInterval(() => {
    cachedNow = Date.now();
    callback();
  }, TICK_MS);
  return () => {
    clearInterval(id);
  };
}

function getServerSnapshot(): number {
  return 0;
}

/**
 * Live LEFT/RIGHT in-game Tarkov clock, ticking every real second - ported
 * from `old/TarkovTrackerWB-main/src/components/maps/mapHeader.js`'s
 * `startTarkovTimeTicker`. Uses `useSyncExternalStore` so the server-rendered
 * markup (a fixed `getServerSnapshot`) never mismatches the client's first
 * `Date.now()`-derived paint - the visible time only appears once hydrated.
 */
export function TarkovClock() {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex items-center gap-1" title="LEFT-side Tarkov in-game time (live)">
        <span className="text-status-amber font-semibold">L</span>
        <span className="tabular-nums">{tarkovClock("left", now)}</span>
      </span>
      <span className="flex items-center gap-1" title="RIGHT-side Tarkov in-game time (live)">
        <span className="text-status-violet font-semibold">R</span>
        <span className="tabular-nums">{tarkovClock("right", now)}</span>
      </span>
    </div>
  );
}
