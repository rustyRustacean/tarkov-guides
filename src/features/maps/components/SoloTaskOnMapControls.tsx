"use client";

import { Crosshair, Layers } from "lucide-react";

import { Button } from "@/shared/ui/button/Button";

import { useSoloTaskStore } from "../solo-task-store";

interface Props {
  taskId: string;
}

/**
 * The "show only this task on the map" pair, rendered inside the task popup
 * (`QuestDetailDialog`'s `actions` slot) on the map screen only - it is
 * meaningless anywhere the map isn't on screen, which is why it lives here
 * in the maps feature and is passed in rather than built into the shared
 * dialog.
 *
 * Soloing is exclusive and temporary by design (see `solo-task-store.ts`):
 * one task at a time, and gone on refresh. The clear button sits right next
 * to it so a focused map is always one click from showing everything again -
 * it stays visible whenever *anything* is soloed, including when the popup is
 * open on some other task, since that is exactly the case where a user is
 * most likely wondering where all the pins went.
 */
export function SoloTaskOnMapControls({ taskId }: Props) {
  const soloTaskId = useSoloTaskStore((state) => state.soloTaskId);
  const soloTask = useSoloTaskStore((state) => state.soloTask);
  const clearSoloTask = useSoloTaskStore((state) => state.clearSoloTask);

  const isSolo = soloTaskId === taskId;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant={isSolo ? "default" : "outline"}
        title="Hide every other task's markers until you clear this or refresh the page"
        aria-pressed={isSolo}
        onClick={() => {
          soloTask(taskId);
        }}
      >
        <Crosshair className="size-4" />
        {isSolo ? "Only this task is shown" : "Show only this task on map"}
      </Button>

      {soloTaskId !== null && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          title="Show every task's markers again"
          onClick={clearSoloTask}
        >
          <Layers className="size-4" />
          Show all tasks
        </Button>
      )}

      {soloTaskId !== null && !isSolo && (
        <span className="text-muted-foreground text-xs">
          Another task is currently the only one on the map.
        </span>
      )}
    </div>
  );
}
