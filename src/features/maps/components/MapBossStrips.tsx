"use client";

import { useMemo, useRef, useState } from "react";

import { useActiveProgress } from "@/features/progress-tracker/hooks/use-active-progress";
import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { SegmentedControl } from "@/shared/ui/segmented-control/SegmentedControl";

import { getBossStripData, GROUND_ZERO_QUEUES, groundZeroQueueFor } from "../lib/boss-groups";

import { BossLoadoutDialog } from "./BossLoadoutDialog";
import { BossStrip } from "./BossStrip";

import type { BossPill, GroundZeroQueue } from "../lib/boss-groups";
import type { RawMob } from "@/shared/lib/tarkov-api/types";

interface Props {
  normalizedName: string;
}

const GROUND_ZERO_OPTIONS = (Object.keys(GROUND_ZERO_QUEUES) as GroundZeroQueue[]).map((queue) => ({
  value: queue,
  label: GROUND_ZERO_QUEUES[queue].label,
}));

/**
 * The current map's boss roster, shown inline in the map-picker row's
 * right-hand group (see `MapsPage.tsx`, alongside the clock and raid-time
 * cards) rather than on its own toolbar ledge: one merged strip (no
 * Day/Night split) that wraps together with that group onto a second row on
 * narrow viewports instead of forcing horizontal scroll. Night-only, event
 * and variant bosses carry a corner glyph rather than a separate labeled
 * side. Renders nothing for a map with no boss data. Self-contained (reads
 * live game data itself), matching this feature's other panel components
 * (e.g. `TaskMarkersLayer`). Clicking a pill opens that boss's gear and loot
 * card (`BossLoadoutDialog`), whose open state lives here.
 *
 * Follows the site-wide game mode from the header (`activeMode`): PvE and
 * Seasonal have their own rosters. On Ground Zero a small toggle picks the
 * level queue, defaulting to the one the active profile's player level
 * lands in until the user picks one themselves.
 */
export function MapBossStrips({ normalizedName }: Props) {
  const { data } = useTarkovGameData();
  const maps = data?.maps ?? [];
  const mobs = data?.mobs;
  const mode = useProgressTrackerStore((state) => state.activeMode);
  const playerLevel = useActiveProgress()?.playerLevel;
  const [chosenQueue, setChosenQueue] = useState<GroundZeroQueue | null>(null);
  const [selected, setSelected] = useState<BossPill | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const mobsById = useMemo(() => {
    const byId: Record<string, RawMob> = {};
    for (const mob of mobs ?? []) byId[mob.id] = mob;
    return byId;
  }, [mobs]);

  const isGroundZero = normalizedName === GROUND_ZERO_QUEUES.low.entry;
  const queue = chosenQueue ?? groundZeroQueueFor(playerLevel);
  const rosterEntry = isGroundZero ? GROUND_ZERO_QUEUES[queue].entry : normalizedName;
  const { pills } = getBossStripData(normalizedName, maps, { mode, rosterEntry });
  const mapName = maps.find((map) => map.normalizedName === rosterEntry)?.name ?? normalizedName;

  if (pills.length === 0 && !isGroundZero) return null;

  return (
    <>
      <div className="flex flex-wrap items-start gap-2">
        {isGroundZero && (
          <SegmentedControl
            aria-label="Ground Zero level queue"
            options={GROUND_ZERO_OPTIONS}
            value={queue}
            onChange={setChosenQueue}
            className="w-auto shrink-0 self-center"
          />
        )}
        <BossStrip
          pills={pills}
          sheenKey={rosterEntry}
          onSelect={(pill, trigger) => {
            triggerRef.current = trigger;
            setSelected(pill);
          }}
        />
      </div>
      <BossLoadoutDialog
        pill={selected}
        mapName={mapName}
        mode={mode}
        mobsById={mobsById}
        returnFocusTo={triggerRef}
        onClose={() => {
          setSelected(null);
        }}
      />
    </>
  );
}
