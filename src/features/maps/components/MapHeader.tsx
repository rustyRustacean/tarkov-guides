"use client";

import { Maximize2, Minimize2 } from "lucide-react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Button } from "@/shared/ui/button/Button";
import { Card } from "@/shared/ui/card/Card";

import { getBossStripData } from "../lib/boss-groups";
import { getRaidTimes } from "../lib/raid-times";

import { BossStrip } from "./BossStrip";
import { MapTimes } from "./MapTimes";
import { MapVariantSwitcher } from "./MapVariantSwitcher";

interface Props {
  normalizedName: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

/**
 * The map screen's toolbar - ported from `old/TarkovTrackerWB-main/src/
 * components/maps/mapHeader.js`, matching its `TarkovTrackerWB.html` layout:
 * variant switcher + raid/extract times + Day boss strip on the left, Night
 * boss strip + a fullscreen toggle on the right. Self-contained (reads live
 * game data itself, matching this feature's other panel components, e.g.
 * `TaskMarkersLayer`) except for the fullscreen toggle - that stays owned by
 * `MapScreenLayout`'s `useFullscreen()` (it needs to attach a DOM ref to a
 * wider element than this toolbar), passed down as `isFullscreen`/
 * `onToggleFullscreen` so the button itself can live in this row.
 *
 * Two stacked rows, not one: the variant switcher (`Tabs`) used to share a
 * row with the raid/extract/players block and the boss strips, so that
 * row's flex cross-axis height tracked the (taller) Tabs and left the
 * shorter items looking pinned near the top instead of vertically centered.
 * Splitting the switcher onto its own row lets the second row's
 * `items-center` actually center its own, now similar-height contents. The
 * live in-game clock (`TarkovClock`) moved out of this toolbar entirely -
 * it overlays the map viewport itself instead (see `MapScreenLayout.tsx`).
 */
export function MapHeader({ normalizedName, isFullscreen, onToggleFullscreen }: Props) {
  const { data } = useTarkovGameData();
  const maps = data?.maps ?? [];
  const map = maps.find((m) => m.normalizedName === normalizedName);

  const raidTimes = getRaidTimes(map);
  const hasRaidTimes = raidTimes.raidMinutes !== null || raidTimes.players !== null;
  const { day, night } = getBossStripData(normalizedName, maps);

  return (
    <div className="flex flex-col gap-3 border-b p-3">
      <MapVariantSwitcher normalizedName={normalizedName} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {hasRaidTimes && (
            <Card className="px-3 py-2">
              <MapTimes raidTimes={raidTimes} />
            </Card>
          )}
          <BossStrip side={day} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <BossStrip side={night} />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen map (F)"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen map (F)"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
