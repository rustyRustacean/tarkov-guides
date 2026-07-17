"use client";

import { useMemo, useState } from "react";

import { getMapConfig } from "@/features/maps/lib/map-config";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";

import { useActiveFaction } from "../hooks/use-active-faction";
import { getBestMapRecommendation } from "../selectors/map-recommendation";
import { useProgressTrackerStore } from "../store";

export interface MapRecommendationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Which map should I run to make the most progress right now?" - the map
 * referenced by the most currently-available tasks, via
 * `getBestMapRecommendation`. `normalizedName` -> proper-cased display name
 * is resolved through the Maps feature's own `getMapConfig` (its canonical
 * source, e.g. `"the-labyrinth"` -> `"Labyrinth"`) rather than a second
 * lookup table. Local `kappaOnly`/`includeLightkeeper` toggle state resets
 * each time this dialog reopens (Radix unmounts closed `DialogContent`).
 */
export function MapRecommendationDialog({ open, onOpenChange }: MapRecommendationDialogProps) {
  const { data } = useTarkovGameData();
  // Read `data?.tasks` directly (not `data?.tasks ?? []`) so the useMemo
  // dependency below is a stable reference when unchanged - same fix as
  // `QuestList`'s `tasksData`.
  const tasksData = data?.tasks;
  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const activeFaction = useActiveFaction();

  const [kappaOnly, setKappaOnly] = useState(false);
  const [includeLightkeeper, setIncludeLightkeeper] = useState(false);

  const recommendation = useMemo(
    () =>
      progress && activeFaction !== undefined
        ? getBestMapRecommendation(tasksData ?? [], progress, activeFaction, {
            kappaOnly,
            includeLightkeeper,
          })
        : null,
    [tasksData, progress, activeFaction, kappaOnly, includeLightkeeper],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>What map do I go to?</DialogTitle>
          <DialogDescription>
            The map with the most currently-available tasks referencing it.
          </DialogDescription>
        </DialogHeader>

        {!progress || activeFaction === undefined ? (
          <p className="text-muted-foreground mt-4 text-sm">
            No active profile - create one to get a recommendation.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-sm">
              <label className="flex items-center gap-1.5">
                <Checkbox
                  checked={kappaOnly}
                  onChange={(event) => {
                    setKappaOnly(event.target.checked);
                  }}
                />
                Kappa only
              </label>
              <label className="flex items-center gap-1.5">
                <Checkbox
                  checked={includeLightkeeper}
                  onChange={(event) => {
                    setIncludeLightkeeper(event.target.checked);
                  }}
                />
                Include Lightkeeper tasks
              </label>
            </div>

            {recommendation ? (
              <p className="text-lg font-medium">
                {getMapConfig(recommendation.normalizedName)?.name ?? recommendation.normalizedName}
                <span className="text-muted-foreground ml-2 text-sm font-normal">
                  {recommendation.taskCount} available task
                  {recommendation.taskCount === 1 ? "" : "s"}
                </span>
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">No tasks match these filters.</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
