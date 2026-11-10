"use client";

import { Clock3 } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { useActiveProgress } from "@/features/progress-tracker/hooks/use-active-progress";
import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { SegmentedControl } from "@/shared/ui/segmented-control/SegmentedControl";

import { useBossSpawnStore } from "../boss-spawn-store";
import { useEnsureMarkerView } from "../hooks/use-ensure-marker-view";
import { getBossStripData, GROUND_ZERO_QUEUES, groundZeroQueueFor } from "../lib/boss-groups";
import { hasSpawnTimeline, spawnSpotsFor } from "../lib/boss-spawns";
import { getMapConfig, markerVariantId } from "../lib/map-config";

import { BossLoadoutDialog } from "./BossLoadoutDialog";
import { BossStrip } from "./BossStrip";
import { SpawnTimelineDialog } from "./SpawnTimelineDialog";

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
 *
 * When any spawn on the map is timed, random or switch-triggered, a "Spawn
 * timeline" button follows the pills (`SpawnTimelineDialog`). The card's
 * "Show on map" plots the boss's possible spawn spots through
 * `boss-spawn-store.ts`, first moving to a view that can draw markers, the
 * same way the exit tools do (`useEnsureMarkerView`). Picking another Ground
 * Zero queue clears them, since they came from the other queue's roster.
 */
export function MapBossStrips({ normalizedName }: Props) {
  const { data } = useTarkovGameData();
  const maps = data?.maps ?? [];
  const mobs = data?.mobs;
  const mode = useProgressTrackerStore((state) => state.activeMode);
  const playerLevel = useActiveProgress()?.playerLevel;
  const [chosenQueue, setChosenQueue] = useState<GroundZeroQueue | null>(null);
  const [selected, setSelected] = useState<BossPill | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const timelineButtonRef = useRef<HTMLButtonElement | null>(null);
  const showSpawnSpots = useBossSpawnStore((state) => state.show);
  const clearSpawnSpots = useBossSpawnStore((state) => state.clear);
  const ensureMarkerView = useEnsureMarkerView(normalizedName);

  const mobsById = useMemo(() => {
    const byId: Record<string, RawMob> = {};
    for (const mob of mobs ?? []) byId[mob.id] = mob;
    return byId;
  }, [mobs]);

  const isGroundZero = normalizedName === GROUND_ZERO_QUEUES.low.entry;
  const queue = chosenQueue ?? groundZeroQueueFor(playerLevel);
  const rosterEntry = isGroundZero ? GROUND_ZERO_QUEUES[queue].entry : normalizedName;
  const { pills } = getBossStripData(normalizedName, maps, { mode, rosterEntry });
  const rosterMap = maps.find((map) => map.normalizedName === rosterEntry);
  const mapName = rosterMap?.name ?? normalizedName;
  const raidMinutes = rosterMap?.raidDuration ?? null;
  const showTimeline = hasSpawnTimeline(pills);
  const config = getMapConfig(normalizedName);
  const canDrawMarkers = config !== undefined && markerVariantId(config.variants) !== null;
  const selectedSpots = selected && canDrawMarkers ? spawnSpotsFor(selected) : null;

  if (pills.length === 0 && !isGroundZero) return null;

  return (
    <>
      <div className="flex flex-wrap items-start gap-2">
        {isGroundZero && (
          <SegmentedControl
            aria-label="Ground Zero level queue"
            options={GROUND_ZERO_OPTIONS}
            value={queue}
            onChange={(next) => {
              setChosenQueue(next);
              clearSpawnSpots();
            }}
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
        {showTimeline && (
          // Shaped like a pill (face-sized tile, label below) so the row keeps
          // its rhythm, but dashed and glyph-only so it never reads as a boss.
          <button
            ref={timelineButtonRef}
            type="button"
            aria-haspopup="dialog"
            title="Timed, random and switch-triggered spawns on this map"
            onClick={() => {
              setTimelineOpen(true);
            }}
            className="group focus-visible:ring-ring flex w-14 cursor-pointer flex-col items-center gap-0.5 rounded-md text-center outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <span className="bg-muted border-border text-muted-foreground group-hover:text-primary group-focus-visible:text-primary flex h-11 w-11 items-center justify-center rounded-md border-2 border-dashed transition duration-200 group-hover:shadow-md motion-safe:group-hover:-translate-y-0.5 motion-safe:group-focus-visible:-translate-y-0.5">
              <Clock3 className="size-5" aria-hidden="true" />
            </span>
            <span className="w-full text-[10px] leading-tight">Spawn timeline</span>
          </button>
        )}
      </div>
      <BossLoadoutDialog
        pill={selected}
        mapName={mapName}
        mode={mode}
        raidMinutes={raidMinutes}
        mobsById={mobsById}
        returnFocusTo={triggerRef}
        onClose={() => {
          setSelected(null);
        }}
        onShowOnMap={
          selected && selectedSpots && selectedSpots.spots.length > 0
            ? () => {
                ensureMarkerView();
                showSpawnSpots({
                  map: normalizedName,
                  mode,
                  name: selected.name,
                  imagePortraitLink: selected.imagePortraitLink,
                  tone: selected.tone,
                  spots: selectedSpots.spots,
                  zonesWithoutSpots: selectedSpots.zonesWithoutSpots,
                });
                setSelected(null);
              }
            : undefined
        }
        onOpenTimeline={
          showTimeline
            ? () => {
                setTimelineOpen(true);
              }
            : undefined
        }
      />
      <SpawnTimelineDialog
        open={timelineOpen && showTimeline}
        onClose={() => {
          setTimelineOpen(false);
        }}
        pills={pills}
        mapName={mapName}
        mapEntry={rosterEntry}
        mode={mode}
        raidMinutes={raidMinutes}
        returnFocusTo={timelineButtonRef}
      />
    </>
  );
}
