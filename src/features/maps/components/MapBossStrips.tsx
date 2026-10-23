"use client";

import { useMemo, useRef, useState } from "react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { getBossStripData } from "../lib/boss-groups";

import { BossLoadoutDialog } from "./BossLoadoutDialog";
import { BossStrip } from "./BossStrip";

import type { BossPill } from "../lib/boss-groups";
import type { RawMob } from "@/shared/lib/tarkov-api/types";

interface Props {
  normalizedName: string;
}

/**
 * The current map's boss roster, shown inline in the map-picker row's
 * right-hand group (see `MapsPage.tsx`, alongside the clock and raid-time
 * cards) rather than on its own toolbar ledge: one merged strip (no
 * Day/Night split) that wraps together with that group onto a second row on
 * narrow viewports instead of forcing horizontal scroll. Night-only and
 * level-gated bosses carry a corner glyph rather than a separate labeled
 * side. Renders nothing for a map with no boss data. Self-contained (reads
 * live game data itself), matching this feature's other panel components
 * (e.g. `TaskMarkersLayer`). Clicking a pill opens that boss's gear and loot
 * card (`BossLoadoutDialog`), whose open state lives here.
 */
export function MapBossStrips({ normalizedName }: Props) {
  const { data } = useTarkovGameData();
  const maps = data?.maps ?? [];
  const mobs = data?.mobs;
  const [selected, setSelected] = useState<BossPill | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const mobsById = useMemo(() => {
    const byId: Record<string, RawMob> = {};
    for (const mob of mobs ?? []) byId[mob.id] = mob;
    return byId;
  }, [mobs]);

  const { pills } = getBossStripData(normalizedName, maps);
  const mapName = maps.find((map) => map.normalizedName === normalizedName)?.name ?? normalizedName;

  if (pills.length === 0) return null;

  return (
    <>
      <BossStrip
        pills={pills}
        sheenKey={normalizedName}
        onSelect={(pill, trigger) => {
          triggerRef.current = trigger;
          setSelected(pill);
        }}
      />
      <BossLoadoutDialog
        pill={selected}
        mapName={mapName}
        mobsById={mobsById}
        returnFocusTo={triggerRef}
        onClose={() => {
          setSelected(null);
        }}
      />
    </>
  );
}
