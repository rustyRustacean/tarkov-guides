import type { QuestAvailability } from "../selectors/quest-availability";

/**
 * Shared task-status → Tailwind class vocabulary, extracted out of
 * `QuestTreeView.tsx` (its original home) so the Swimlane Matrix and
 * Vertical Accordion views can render the exact same status coloring
 * instead of each re-deriving their own.
 */
export const STATUS_NODE_CLASS: Record<string, string> = {
  done: "border-status-green bg-status-green-soft",
  failed: "border-status-red bg-status-red-soft",
  inprog: "border-status-teal bg-status-teal-soft",
  // Amber background only, neutral border. An amber outline read as too
  // close to a highlighted/selected state; the soft fill alone is enough
  // to distinguish "available" from "locked" at a glance.
  available: "border-border bg-status-amber-soft",
  locked: "border-border bg-muted/40",
};

/**
 * Same tint as `STATUS_NODE_CLASS`'s `bg-*` half, but as a raw CSS color
 * (not a Tailwind class) so callers that need to flatten it onto an opaque
 * backdrop, e.g. `QuestChainStack`'s front card, can layer it as a
 * `backgroundImage` gradient over a solid `backgroundColor` instead of
 * letting the translucent color composite with whatever paints behind the
 * element (its own stacked ghost cards, in that case).
 */
export const STATUS_NODE_TINT: Record<string, string> = {
  done: "var(--color-status-green-soft)",
  failed: "var(--color-status-red-soft)",
  inprog: "var(--color-status-teal-soft)",
  available: "var(--color-status-amber-soft)",
  locked: "color-mix(in oklab, var(--color-muted) 40%, transparent)",
};

export const STATUS_LEGEND: readonly { label: string; swatchClass: string }[] = [
  { label: "Done", swatchClass: "border-status-green bg-status-green-soft" },
  { label: "In progress", swatchClass: "border-status-teal bg-status-teal-soft" },
  { label: "Available", swatchClass: "border-border bg-status-amber-soft" },
  { label: "Locked", swatchClass: "border-border bg-muted/40" },
  { label: "Failed", swatchClass: "border-status-red bg-status-red-soft" },
];

/** `STATUS_NODE_CLASS`'s lookup key for a task: its real status once started, else "available"/"locked" depending on whether every gate is currently met. */
export function nodeStatusKey(availability: QuestAvailability | undefined): string {
  if (!availability) return "locked";
  if (availability.status !== "notstarted") return availability.status;
  return availability.isAvailable ? "available" : "locked";
}
