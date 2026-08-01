import { create } from "zustand";

/**
 * One entry in the detail drilldown stack - either an item-detail popup or a
 * task-detail popup. Modeled on legacy `modals.js`'s `_MODAL_STACK`/
 * `_MODAL_CURRENT`, which let the user drill item → task → item and walk
 * back out in reverse.
 */
export type DetailTarget = { type: "item"; id: string } | { type: "task"; id: string };

interface ItemDetailStoreState {
  /** Whatever popup is on screen right now, or `null` when nothing is open. */
  current: DetailTarget | null;
  /** Earlier popups the user drilled through, walked in reverse by {@link back}. */
  stack: readonly DetailTarget[];
  /** Open an item-detail popup, pushing the current one (if any) onto the stack. */
  openItem: (itemId: string) => void;
  /** Open a task-detail popup, pushing the current one (if any) onto the stack. */
  openTask: (taskId: string) => void;
  /** Step back to the previous popup; closes everything when the stack is empty. */
  back: () => void;
  /** Close the whole drilldown - next open starts fresh, matching legacy's `closeTask()`. */
  close: () => void;
}

/**
 * Backs the single app-wide item/task detail dialogs (mounted once in
 * `app/providers.tsx`, the same imperative-singleton shape as the toast
 * store). Any item row anywhere can call `useItemDetailStore.getState()
 * .openItem(id)` from a plain event handler to open the detail popup -
 * there's no per-call-site dialog state to thread.
 *
 * `current` + `stack` together model the drilldown chain: opening a popup
 * pushes whatever was showing onto `stack`; {@link back} pops it. This is a
 * separate concern from Progress Tracker's own locally-mounted
 * `QuestDetailDialog` instances (which keep their own `selectedTaskId`
 * state) - those stay as-is; this only powers cross-surface item clicks.
 */
export const useItemDetailStore = create<ItemDetailStoreState>((set) => ({
  current: null,
  stack: [],
  openItem: (itemId) => {
    set((state) => ({
      current: { type: "item", id: itemId },
      stack: state.current ? [...state.stack, state.current] : state.stack,
    }));
  },
  openTask: (taskId) => {
    set((state) => ({
      current: { type: "task", id: taskId },
      stack: state.current ? [...state.stack, state.current] : state.stack,
    }));
  },
  back: () => {
    set((state) => {
      if (state.stack.length === 0) return { current: null, stack: [] };
      const previous = state.stack[state.stack.length - 1] ?? null;
      return { current: previous, stack: state.stack.slice(0, -1) };
    });
  },
  close: () => {
    set({ current: null, stack: [] });
  },
}));

/** Imperative helper - open an item-detail popup from anywhere (handlers, not just components). */
export function openItemDetail(itemId: string): void {
  useItemDetailStore.getState().openItem(itemId);
}
