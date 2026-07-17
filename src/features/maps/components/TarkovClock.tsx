"use client";

import { useSyncExternalStore } from "react";

import { tarkovClock } from "../lib/tarkov-clock";

const TICK_MS = 1000;

function subscribe(callback: () => void): () => void {
  const id = setInterval(callback, TICK_MS);
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
  const now = useSyncExternalStore(subscribe, Date.now, getServerSnapshot);

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex items-center gap-1" title="LEFT-side Tarkov in-game time (live)">
        <span className="text-muted-foreground font-semibold">L</span>
        <span className="tabular-nums">{tarkovClock("left", now)}</span>
      </span>
      <span className="flex items-center gap-1" title="RIGHT-side Tarkov in-game time (live)">
        <span className="text-muted-foreground font-semibold">R</span>
        <span className="tabular-nums">{tarkovClock("right", now)}</span>
      </span>
    </div>
  );
}
