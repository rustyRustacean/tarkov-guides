"use client";

import { Check, Lock, Star } from "lucide-react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card/Card";

import { useActiveProgress } from "../hooks/use-active-progress";
import { useHideoutTracker } from "../hooks/use-hideout-tracker";
import { getHideoutGoalPath, getHideoutLevelStatus } from "../lib/hideout";

import { HideoutGoalBanner } from "./HideoutGoalBanner";
import { NoActiveProfileNotice } from "./NoActiveProfileNotice";

import type { RawHideoutStation } from "@/shared/lib/tarkov-api/types";

const STATUS_VARIANT = {
  done: "default",
  started: "outline",
  locked: "ghost",
} as const;

/**
 * Station list with a per-level build toggle, plus the hideout goal
 * banner. Self-contained (reads live game data + the active profile
 * itself, same pattern as `KappaTracker`/`RaidCommitBar`). Deliberately
 * drops legacy's per-station item-requirement preview strip and its
 * click-through level-detail modal - both are item-need tracking, already
 * fully covered by `KappaTracker`'s "Hideout items" tab and
 * `ItemTrackerBoard`, so a third surface here would just duplicate that.
 */
export function HideoutTracker() {
  const { data } = useTarkovGameData();
  const stationsData = data?.hideoutStations;
  const stations: readonly RawHideoutStation[] = stationsData ?? [];

  const progress = useActiveProgress();
  const { toggleLevel, toggleGoal } = useHideoutTracker();

  if (!progress) {
    return <NoActiveProfileNotice reason="start tracking hideout progress" />;
  }

  return (
    <div className="flex flex-col gap-4">
      <HideoutGoalBanner
        goal={progress.hideoutGoal}
        stations={stations}
        hideoutBuilt={progress.hideoutBuilt}
        onClear={() => {
          const goal = progress.hideoutGoal;
          if (!goal) return;
          const station = stations.find(
            (candidate) => candidate.normalizedName === goal.stationNormalizedName,
          );
          toggleGoal(
            goal.stationNormalizedName,
            station?.name ?? goal.stationNormalizedName,
            goal.level,
          );
        }}
      />

      {stations.map((station) => (
        <Card key={station.id}>
          <CardHeader>
            <CardTitle>{station.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {station.levels.map((level) => {
              const status = getHideoutLevelStatus(
                stations,
                progress.hideoutBuilt,
                station.normalizedName,
                level.level,
              );
              const blockers =
                status === "locked"
                  ? getHideoutGoalPath(
                      stations,
                      progress.hideoutBuilt,
                      station.normalizedName,
                      level.level,
                    ).filter((step) => !step.isGoal)
                  : [];
              const isGoal =
                progress.hideoutGoal?.stationNormalizedName === station.normalizedName &&
                progress.hideoutGoal.level === level.level;

              return (
                <span key={level.level} className="inline-flex items-center gap-1">
                  <Button
                    type="button"
                    variant={STATUS_VARIANT[status]}
                    size="sm"
                    title={
                      status === "locked"
                        ? `Locked - needs: ${blockers.map((step) => `${step.stationName} L${String(step.level)}`).join(", ")}`
                        : undefined
                    }
                    onClick={() => {
                      toggleLevel(station.normalizedName, station.name, level.level);
                    }}
                  >
                    {status === "done" && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                    {status === "locked" && <Lock className="h-3.5 w-3.5" aria-hidden="true" />}L
                    {level.level}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${isGoal ? "Clear" : "Set"} goal: ${station.name} L${String(level.level)}`}
                    aria-pressed={isGoal}
                    onClick={() => {
                      toggleGoal(station.normalizedName, station.name, level.level);
                    }}
                  >
                    <Star
                      className="h-4 w-4"
                      aria-hidden="true"
                      fill={isGoal ? "currentColor" : "none"}
                    />
                  </Button>
                </span>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
