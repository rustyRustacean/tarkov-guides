"use client";

import { useMemo, useState } from "react";

import { getMapConfig } from "@/features/maps/lib/map-config";
import { Badge } from "@/shared/ui/badge/Badge";
import { Card, CardContent } from "@/shared/ui/card/Card";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";
import { useItemDetailStore } from "@/shared/ui/item-detail/item-detail-store";
import { cn } from "@/shared/ui/lib/cn";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import { useActiveFaction } from "../hooks/use-active-faction";
import { useActiveModeTasks } from "../hooks/use-active-mode-tasks";
import { useActiveProgress } from "../hooks/use-active-progress";
import { getMapRecommendations } from "../selectors/map-recommendation";

import { NoActiveProfileNotice } from "./NoActiveProfileNotice";

export interface MapRecommendationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Which map should I run to make the most progress right now?" Every map
 * referenced by a currently-available task, via `getMapRecommendations`,
 * each with its own tasks listed underneath so this doubles as "what should
 * I do next" (formerly the separate `QuestRecommendations` tab, folded in
 * here since both questions, where to go and what to do there, are really
 * one decision). The map with the most available tasks sorts first and
 * gets the "Best" emphasis treatment. `normalizedName` -> proper-cased
 * display name is resolved through the Maps feature's own `getMapConfig`
 * (its canonical source, e.g. `"the-labyrinth"` -> `"Labyrinth"`) rather
 * than a second lookup table. Local `kappaOnly`/`includeLightkeeper` toggle
 * state is not reset on close: it lives in this component, which
 * `QuestBoard` renders unconditionally, so only Radix's `DialogContent`
 * portal unmounts on close, not this component itself. The toggles persist
 * across close/reopen for as long as the Quests tab stays mounted (unlike
 * `CustomItemDialog`, which explicitly calls `resetForm()` on close because
 * its state genuinely shouldn't survive), arguably the more useful
 * behavior here, since re-checking the same filters on every open would be
 * needless friction. A task click routes through the app-wide
 * `useItemDetailStore` (its `QuestDetailDialog` is mounted once in
 * `DetailDialogs`) rather than a locally-mounted `QuestDetailDialog`, since
 * this dialog is already itself a modal: stacking a second, independently
 * managed Radix dialog on top would need its own dismiss/focus coordination
 * that the shared store already handles. Each location's title links to
 * that map on the Maps page via `?map=NORMALIZED_NAME` (see
 * `useMapUrlParam`, which applies and strips it) rather than reaching into
 * `useMapsStore` directly, since this dialog can render before the Maps
 * feature's store/persistence hooks are ever mounted.
 */
export function MapRecommendationDialog({ open, onOpenChange }: MapRecommendationDialogProps) {
  // `tasks` (not `tasks ?? []`) so the useMemo dependency below is a stable
  // reference when unchanged, same fix as `QuestList`'s `tasksData`.
  const { tasks: tasksData } = useActiveModeTasks();
  const progress = useActiveProgress();
  const activeFaction = useActiveFaction();

  const [kappaOnly, setKappaOnly] = useState(false);
  const [includeLightkeeper, setIncludeLightkeeper] = useState(false);
  const openTask = useItemDetailStore((state) => state.openTask);

  const recommendations = useMemo(
    () =>
      progress && activeFaction !== undefined
        ? getMapRecommendations(tasksData ?? [], progress, activeFaction, {
            kappaOnly,
            includeLightkeeper,
          })
        : [],
    [tasksData, progress, activeFaction, kappaOnly, includeLightkeeper],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>What map do I go to?</DialogTitle>
          <DialogDescription>
            Every location with a currently-available task, best first.
          </DialogDescription>
        </DialogHeader>

        {!progress || activeFaction === undefined ? (
          <div className="mt-4">
            <NoActiveProfileNotice reason="get a recommendation" />
          </div>
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

            {recommendations.length === 0 ? (
              <p className="text-muted-foreground text-sm">No tasks match these filters.</p>
            ) : (
              <div className="-mr-2 flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-2">
                {recommendations.map((recommendation, index) => {
                  const isBest = index === 0;
                  const displayName =
                    getMapConfig(recommendation.normalizedName)?.name ??
                    recommendation.normalizedName;

                  return (
                    <Card
                      key={recommendation.normalizedName}
                      className={cn(isBest && "border-primary bg-primary/5")}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {isBest && <Badge variant="green">Best</Badge>}
                            <TransitionLink
                              href={`/maps?map=${recommendation.normalizedName}`}
                              className="font-display hover:text-primary text-base font-semibold hover:underline"
                            >
                              {displayName}
                            </TransitionLink>
                          </div>
                          <span className="text-muted-foreground text-xs">
                            {recommendation.taskCount} task
                            {recommendation.taskCount === 1 ? "" : "s"}
                          </span>
                        </div>

                        <ul className="mt-3 flex flex-col gap-1.5">
                          {recommendation.tasks.map((task) => (
                            <li key={task.id}>
                              <button
                                type="button"
                                className="hover:bg-secondary flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left transition-colors"
                                onClick={() => {
                                  openTask(task.id);
                                }}
                              >
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <span className="truncate text-sm">{task.name}</span>
                                  {task.kappaRequired && <Badge variant="kappa">Kappa</Badge>}
                                </span>
                                <span className="text-muted-foreground shrink-0 text-xs">
                                  {task.trader.name} · Lv {task.minPlayerLevel}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
