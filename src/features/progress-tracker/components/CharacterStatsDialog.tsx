"use client";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";

import { useProgressTrackerStore } from "../store";

export interface CharacterStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const inputClassName =
  "border-border bg-background focus-visible:ring-ring rounded-md border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none";

function parseIntegerInput(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseNumberInput(value: string, fallback: number): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Player level and per-trader loyalty-level/reputation inputs - the
 * concrete UI for the real quest-availability gating built in
 * `src/shared/lib/tarkov-api` (step 1) and
 * `selectors/quest-availability.ts` (step 4). Reads the live trader list
 * from `useTarkovGameData()` rather than a hardcoded roster, so it always
 * matches the current tarkov.dev trader set.
 */
export function CharacterStatsDialog({ open, onOpenChange }: CharacterStatsDialogProps) {
  const { data } = useTarkovGameData();
  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const setPlayerLevel = useProgressTrackerStore((state) => state.setPlayerLevel);
  const setPrestigeLevel = useProgressTrackerStore((state) => state.setPrestigeLevel);
  const setTraderLevel = useProgressTrackerStore((state) => state.setTraderLevel);
  const setTraderReputation = useProgressTrackerStore((state) => state.setTraderReputation);

  const traders = data?.traders ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Character Stats</DialogTitle>
          <DialogDescription>
            Used to determine which quests show as available, matched against each quest&apos;s real
            player-level and trader-loyalty requirements.
          </DialogDescription>
        </DialogHeader>

        {activeProfileId === null || !progress ? (
          <p className="text-muted-foreground mt-4 text-sm">
            No active profile - create one to set character stats.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <label className="flex flex-col gap-1 text-sm">
              Player Level
              <input
                type="number"
                min={1}
                value={progress.playerLevel}
                onChange={(event) => {
                  setPlayerLevel(Math.max(1, parseIntegerInput(event.target.value, 1)));
                }}
                className={`${inputClassName} w-24`}
              />
            </label>

            <label className="flex flex-col gap-1 text-sm">
              Prestige Level
              <input
                type="number"
                min={0}
                value={progress.prestigeLevel}
                onChange={(event) => {
                  setPrestigeLevel(Math.max(0, parseIntegerInput(event.target.value, 0)));
                }}
                className={`${inputClassName} w-24`}
              />
            </label>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Trader Standing</h3>
              {traders.length === 0 ? (
                <p className="text-muted-foreground text-sm">Loading trader data…</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {traders.map((trader) => (
                    <div key={trader.id} className="flex items-center gap-3 text-sm">
                      <span className="w-28 shrink-0 truncate">{trader.name}</span>
                      <label className="flex items-center gap-1.5">
                        Level
                        <input
                          type="number"
                          min={0}
                          value={progress.traderLevels[trader.id] ?? 1}
                          onChange={(event) => {
                            setTraderLevel(
                              trader.id,
                              Math.max(0, parseIntegerInput(event.target.value, 1)),
                            );
                          }}
                          className={`${inputClassName} w-16`}
                        />
                      </label>
                      <label className="flex items-center gap-1.5">
                        Rep
                        <input
                          type="number"
                          value={progress.traderReputation[trader.id] ?? 0}
                          onChange={(event) => {
                            setTraderReputation(trader.id, parseNumberInput(event.target.value, 0));
                          }}
                          className={`${inputClassName} w-16`}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
