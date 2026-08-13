"use client";

import { Button } from "@/shared/ui/button/Button";

import { useActiveProgress } from "../hooks/use-active-progress";
import { useRaidCommit } from "../hooks/use-raid-commit";

/**
 * DIED/EXTRACTED controls for the current raid's pending items. Both
 * buttons are disabled when nothing is pending, avoiding a meaningless
 * toast/undo entry for an empty raid.
 */
export function RaidCommitBar() {
  const progress = useActiveProgress();
  const { extract, die } = useRaidCommit();

  if (!progress) return null;

  const pendingCount = Object.values(progress.pending).reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted-foreground">
        {pendingCount > 0
          ? `${String(pendingCount)} pending item${pendingCount === 1 ? "" : "s"} this raid`
          : "No pending items"}
      </span>
      <Button
        type="button"
        variant="default"
        size="sm"
        disabled={pendingCount === 0}
        onClick={extract}
      >
        Extracted
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pendingCount === 0}
        onClick={die}
      >
        Died
      </Button>
    </div>
  );
}
