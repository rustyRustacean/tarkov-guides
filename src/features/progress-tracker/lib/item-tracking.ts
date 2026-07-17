/**
 * Item-level stash/pending math and the raid-commit (DIED/EXTRACTED)
 * workflow, ported as pure reducers from
 * `old/TarkovTrackerWB-main/src/components/items/itemAdjust.js`. All
 * progress is keyed by real tarkov.dev item ids throughout this app (never
 * the mixed shortName/hideout-item-id keyspace legacy used).
 */

import type { CustomItemEntry } from "../types";

function clampNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

/** How much of `need` is still outstanding once stash is accounted for. Floors at 0, matching legacy's `itemRows.js`. */
export function getRemaining(need: number, have: number): number {
  return Math.max(0, need - have);
}

/** Direct stash-count set (legacy's `editStash` - a `prompt()`-based direct edit, never touches `pending`). */
export function editStash(
  have: Readonly<Record<string, number>>,
  itemId: string,
  count: number,
): Readonly<Record<string, number>> {
  return { ...have, [itemId]: clampNonNegativeInteger(count) };
}

/** Adjusts a this-raid pending count by a signed delta, floored at 0 (matches legacy's `adj`). */
export function adjustPending(
  pending: Readonly<Record<string, number>>,
  itemId: string,
  delta: number,
): Readonly<Record<string, number>> {
  const next = clampNonNegativeInteger((pending[itemId] ?? 0) + delta);
  return { ...pending, [itemId]: next };
}

/**
 * Money-item whole-amount fill: `direction > 0` OVERWRITES pending with the
 * entire remaining amount (`need - have`, floored at 0) - not additive with
 * any existing pending. `direction < 0` clears pending to 0 outright. Matches
 * legacy's `fillMoney` exactly (deliberately different semantics from
 * {@link adjustPending}'s delta-based stepper).
 */
export function fillMoneyPending(
  pending: Readonly<Record<string, number>>,
  have: Readonly<Record<string, number>>,
  itemId: string,
  need: number,
  direction: 1 | -1,
): Readonly<Record<string, number>> {
  if (direction < 0) return { ...pending, [itemId]: 0 };
  return { ...pending, [itemId]: getRemaining(need, have[itemId] ?? 0) };
}

export interface RaidCommitResult {
  have: Readonly<Record<string, number>>;
  pending: Readonly<Record<string, number>>;
}

/**
 * EXTRACTED: every pending item (task/hideout/custom/pinned - legacy mixes
 * them in one flat keyspace with no per-item source tagging, and this port
 * keeps that) is merged into `have`, then `pending` is fully cleared. Matches
 * legacy's `confirmRaid` exactly - no secure-container-aware partial loss
 * modeling (a deliberate parity decision, see the feature README).
 */
export function confirmRaid(
  have: Readonly<Record<string, number>>,
  pending: Readonly<Record<string, number>>,
): RaidCommitResult {
  const nextHave: Record<string, number> = { ...have };
  for (const [itemId, count] of Object.entries(pending)) {
    nextHave[itemId] = (nextHave[itemId] ?? 0) + count;
  }
  return { have: nextHave, pending: {} };
}

/**
 * DIED: pending is discarded unconditionally (regardless of its contents,
 * hence no `pending` parameter); `have` is untouched. Matches legacy's
 * `cancelRaid`.
 */
export function cancelRaid(have: Readonly<Record<string, number>>): RaidCommitResult {
  return { have, pending: {} };
}

/**
 * Adds a custom item, keyed by its real tarkov.dev item id (not a synthetic
 * one - see `CustomItemEntry.id`'s doc comment for why: this lets a
 * custom-added item share the same stash row as the same item required by a
 * task). Updates `need` in place if the id is already tracked, else appends.
 * Ported from legacy's `customItems.js`'s `addCustomItem`, adapted to match
 * by real id instead of `shortName`.
 */
export function upsertCustomItem(
  customItems: readonly CustomItemEntry[],
  entry: { id: string; name: string; iconLink: string | null },
  need: number,
): readonly CustomItemEntry[] {
  const existingIndex = customItems.findIndex((item) => item.id === entry.id);
  if (existingIndex === -1) return [...customItems, { ...entry, need }];
  return customItems.map((item, index) => (index === existingIndex ? { ...item, need } : item));
}

/** Removes a custom item by id. Ported from legacy's `customItems.js`'s `removeCustomItem`. */
export function removeCustomItemEntry(
  customItems: readonly CustomItemEntry[],
  id: string,
): readonly CustomItemEntry[] {
  return customItems.filter((item) => item.id !== id);
}
