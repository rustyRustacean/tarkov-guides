import type { RaidTimes } from "../lib/raid-times";

interface Props {
  raidTimes: RaidTimes;
}

/**
 * Stacked Raid duration / earliest-Extract / Players block - ported from
 * `old/TarkovTrackerWB-main/src/components/maps/mapHeader.js`'s
 * `renderMapTimes`. Renders nothing once there's genuinely no data for this
 * map (matches legacy's own empty-state, which relies on a `:empty` CSS
 * rule for the same effect).
 */
export function MapTimes({ raidTimes }: Props) {
  if (raidTimes.raidMinutes === null && !raidTimes.players) return null;

  return (
    <div className="flex flex-col gap-0.5 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-status-amber font-semibold tracking-wide uppercase">Raid</span>
        <span className="tabular-nums">
          {raidTimes.raidMinutes !== null ? `${String(raidTimes.raidMinutes)}m` : "…"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-status-green font-semibold tracking-wide uppercase">Extract ≥</span>
        <span className="tabular-nums">
          {raidTimes.extractMinutes !== null ? `${String(raidTimes.extractMinutes)}m` : "…"}
        </span>
      </div>
      {raidTimes.players && (
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-semibold tracking-wide uppercase">
            Players
          </span>
          <span className="tabular-nums">{raidTimes.players}</span>
        </div>
      )}
    </div>
  );
}
