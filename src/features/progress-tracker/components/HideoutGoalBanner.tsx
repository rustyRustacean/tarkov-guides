import { Star } from "lucide-react";

import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";

import { getHideoutGoalPath } from "../lib/hideout";

import type { HideoutBuiltKey, HideoutGoal } from "../types";
import type { RawHideoutStation } from "@/shared/lib/tarkov-api/types";

export interface HideoutGoalBannerProps {
  goal: HideoutGoal | null;
  stations: readonly RawHideoutStation[];
  hideoutBuilt: Readonly<Record<HideoutBuiltKey, true>>;
  onClear: () => void;
}

/**
 * Shows the ordered build path to the player's chosen hideout goal, via
 * the already-built {@link getHideoutGoalPath}. Manual-clear only - legacy's
 * own code comment describes an auto-clear-on-complete behavior that was
 * never actually implemented (confirmed via research), so this always
 * shows a CLEAR button rather than silently dropping a completed goal.
 * Renders nothing when no goal is set.
 */
export function HideoutGoalBanner({
  goal,
  stations,
  hideoutBuilt,
  onClear,
}: HideoutGoalBannerProps) {
  if (!goal) return null;

  const path = getHideoutGoalPath(stations, hideoutBuilt, goal.stationNormalizedName, goal.level);
  const station = stations.find(
    (candidate) => candidate.normalizedName === goal.stationNormalizedName,
  );
  const stationName = station?.name ?? goal.stationNormalizedName;
  const isComplete = path.length === 0;
  const blockerCount = Math.max(0, path.length - 1);

  return (
    <div className="border-border bg-card flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-medium">
            <Star className="h-4 w-4" aria-hidden="true" />
            {isComplete
              ? `Goal complete: ${stationName} L${String(goal.level)}`
              : `Goal: ${stationName} L${String(goal.level)}`}
          </div>
          {!isComplete && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {blockerCount} prerequisite{blockerCount === 1 ? "" : "s"} blocking · ordered shortest
              build path
            </p>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onClear}>
          Clear
        </Button>
      </div>

      {!isComplete && (
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {path.map((step, index) => (
            <li
              key={`${step.stationNormalizedName}:${String(step.level)}`}
              className="flex items-center gap-2"
            >
              {index > 0 && <span aria-hidden="true">→</span>}
              <Badge variant={step.isGoal ? "amber" : "outline"}>
                {step.isGoal && "★ "}
                {step.stationName} L{step.level}
              </Badge>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
