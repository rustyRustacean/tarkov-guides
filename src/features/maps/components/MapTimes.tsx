import { DoorOpen, Timer, Users } from "lucide-react";

import type { RaidTimes } from "../lib/raid-times";

interface Props {
  raidTimes: RaidTimes;
}

/**
 * Inline, icon-led Raid duration / earliest-Extract / Players readout,
 * ported from `old/TarkovTrackerWB-main/src/components/maps/mapHeader.js`'s
 * `renderMapTimes`, restyled from 3 stacked ALL-CAPS-labeled lines to one
 * compact row: an icon carries each label's meaning instead of spelling it
 * out, which is what actually made room to combine this with `TarkovClock`
 * in one shared card (see `MapsPage.tsx`). Renders nothing when there's no
 * data for this map, matching legacy's `:empty` CSS-based empty state.
 */
export function MapTimes({ raidTimes }: Props) {
  if (raidTimes.raidMinutes === null && !raidTimes.players) return null;

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="flex items-center gap-1" title="Raid duration">
        <Timer className="text-status-amber size-3.5 shrink-0" aria-hidden="true" />
        <span className="tabular-nums">
          {raidTimes.raidMinutes !== null ? `${String(raidTimes.raidMinutes)}m` : "…"}
        </span>
      </span>
      <span className="flex items-center gap-1" title="Earliest extract time">
        <DoorOpen className="text-status-green size-3.5 shrink-0" aria-hidden="true" />
        <span className="tabular-nums">
          {raidTimes.extractMinutes !== null ? `≥${String(raidTimes.extractMinutes)}m` : "…"}
        </span>
      </span>
      {raidTimes.players && (
        <span className="flex items-center gap-1" title="Player count">
          <Users className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">{raidTimes.players}</span>
        </span>
      )}
    </div>
  );
}
