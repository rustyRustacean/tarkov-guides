import { create } from "zustand";

export interface SoloTaskState {
  /** The one task whose markers are shown, hiding every other task's. `null` = show them all. */
  soloTaskId: string | null;
  /** Exclusive by construction - soloing a task replaces whatever was soloed before, there is no multi-select. */
  soloTask: (taskId: string) => void;
  clearSoloTask: () => void;
}

/**
 * "Show only this task on the map", a focus mode for a crowded map.
 *
 * Deliberately its own tiny store, plain in-memory with no persistence and
 * not scoped per profile: this is a temporary "let me look at just this one
 * thing" state, and it should last until the page is refreshed or another
 * task takes over. `useMapsStore`'s own state is snapshotted to storage (see
 * `persistence/serialize.ts`), so putting it there would have made it survive
 * reloads - the opposite of what this is.
 */
export const useSoloTaskStore = create<SoloTaskState>((set) => ({
  soloTaskId: null,
  soloTask(taskId) {
    set({ soloTaskId: taskId });
  },
  clearSoloTask() {
    set({ soloTaskId: null });
  },
}));
