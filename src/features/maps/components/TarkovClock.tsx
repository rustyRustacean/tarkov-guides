"use client";

import { Clock } from "lucide-react";
import { useSyncExternalStore } from "react";

import { tarkovClock } from "../lib/tarkov-clock";

const TICK_MS = 1000;

// `useSyncExternalStore`'s `getSnapshot` must return a value that's stable
// between calls until the store actually changes: React re-invokes it more
// than once per commit (StrictMode's double-render, plus its own tearing
// check) to verify that. Passing `Date.now` directly as `getSnapshot` fails
// that check, since two calls microseconds apart can straddle a millisecond
// boundary and return different numbers, surfacing as React's "The result
// of getSnapshot should be cached to avoid an infinite loop" console error.
// Caching the real time in this module-level variable, refreshed only from
// `subscribe`'s own tick (plus once synchronously on subscribe, so a fresh
// mount doesn't briefly show a stale value from a previous mount/import),
// keeps `getSnapshot` pure.
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
 * Live in-game Tarkov clock, ticking every real second: two readouts 12
 * hours apart (the two in-game times a raid launched right now could open
 * on), color-coded rather than lettered ("L"/"R" in an earlier version) so
 * the pair reads as "two live clocks" without spelling it out. Ported from
 * `old/TarkovTrackerWB-main/src/components/maps/mapHeader.js`'s
 * `startTarkovTimeTicker`. Uses `useSyncExternalStore` so the
 * server-rendered markup (a fixed `getServerSnapshot`) never mismatches the
 * client's first `Date.now()`-derived paint; the visible time only appears
 * once hydrated.
 */
export function TarkovClock() {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <div className="flex items-center gap-1.5 text-xs" title="Live in-game time, 12 hours apart">
      <Clock className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
      <span className="text-status-amber font-semibold tabular-nums" title="In-game time (live)">
        {tarkovClock("left", now)}
      </span>
      <span className="text-muted-foreground/60" aria-hidden="true">
        &middot;
      </span>
      <span
        className="text-status-violet font-semibold tabular-nums"
        title="In-game time, 12 hours later (live)"
      >
        {tarkovClock("right", now)}
      </span>
    </div>
  );
}
