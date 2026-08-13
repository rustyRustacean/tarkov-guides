import { create } from "zustand";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  message: string;
  /** An inline action button (e.g. "UNDO") shown alongside the message. */
  action?: ToastAction;
  /** Overrides the default duration (2500ms, or 6000ms when `action` is present). */
  durationMs?: number;
}

interface ActiveToast extends ToastOptions {
  id: number;
  durationMs: number;
}

interface ToastStoreState {
  toast: ActiveToast | null;
  show: (options: ToastOptions) => void;
  dismiss: () => void;
}

let nextId = 0;

export const useToastStore = create<ToastStoreState>((set) => ({
  toast: null,
  show: ({ message, action, durationMs }) => {
    nextId += 1;
    set({
      toast: {
        id: nextId,
        message,
        // Matches old/TarkovTrackerWB-main/src/lib/toast.js: a plain toast
        // dismisses after 2500ms; an action/"undo" toast (with an inline
        // button) stays up longer (6000ms) so it's easier to catch.
        durationMs: durationMs ?? (action ? 6000 : 2500),
        // `exactOptionalPropertyTypes` treats an explicit `action: undefined`
        // as distinct from an omitted key, so spread conditionally to keep
        // the key entirely absent rather than present-with-undefined.
        ...(action ? { action } : {}),
      },
    });
  },
  dismiss: () => {
    set({ toast: null });
  },
}));

/**
 * Imperative toast API: call from anywhere (event handlers, not just
 * components) to show a toast. Only one toast is ever shown at a time;
 * calling this again replaces whatever is currently showing, matching the
 * legacy site's single shared dismiss-timer behavior.
 *
 * Undo/mutation-tracking logic (what the action button actually undoes) is
 * intentionally out of scope here; that belongs to the feature calling this
 * API (e.g. Progress Tracker), which should pass its own `action.onClick`.
 */
export function toast(options: ToastOptions) {
  useToastStore.getState().show(options);
}
