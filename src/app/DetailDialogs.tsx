"use client";

import { QuestDetailDialog } from "@/features/progress-tracker/components/QuestDetailDialog";
import { useItemDetailStore } from "@/shared/ui/item-detail/item-detail-store";
import { ItemDetailDialog } from "@/shared/ui/item-detail/ItemDetailDialog";

/**
 * The single app-wide item/task detail popups, mounted once here (the same
 * imperative-singleton shape as `Toaster`). Any item row anywhere opens the
 * item popup via `useItemDetailStore.getState().openItem(id)`; from there,
 * task links drill into the quest popup and item chips drill into another
 * item, and the store's nav stack walks the chain back.
 *
 * This lives at the app layer (not in `shared/ui` alongside
 * `ItemDetailDialog`) specifically so it can wire the store to Progress
 * Tracker's `QuestDetailDialog` without `shared/ui` taking a dependency on a
 * feature. Progress Tracker's own locally-mounted `QuestDetailDialog`
 * instances are unaffected: they keep their own `selectedTaskId` state; this
 * global one only opens when an item popup routes a task click through the
 * store.
 */
export function DetailDialogs() {
  const current = useItemDetailStore((state) => state.current);
  const openTask = useItemDetailStore((state) => state.openTask);
  const close = useItemDetailStore((state) => state.close);

  const taskId = current?.type === "task" ? current.id : null;

  return (
    <>
      <ItemDetailDialog />
      <QuestDetailDialog
        taskId={taskId}
        onOpenChange={(open) => {
          if (!open) close();
        }}
        onSelectTask={(id) => {
          openTask(id);
        }}
      />
    </>
  );
}
