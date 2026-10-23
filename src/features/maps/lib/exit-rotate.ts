import { exitKey } from "./exit-path";

import type { AppliedExit } from "./exit-snip";

/**
 * The exit the keys move to: the next (or previous) listed exit of one kind,
 * wrapping around. Exits whose availability is unknown (`???`) are skipped
 * unless nothing else of that kind is left.
 *
 * `currentKey` is the exit now selected. When it is not one of this kind
 * (nothing selected, or a transit while stepping exfils) stepping forward
 * starts from the first and stepping back from the last.
 */
export function rotateExit(
  exits: readonly AppliedExit[],
  currentKey: string | null,
  kind: AppliedExit["kind"],
  step: number,
): AppliedExit | null {
  const ofKind = exits.filter((exit) => exit.kind === kind);
  const usable = ofKind.filter((exit) => !exit.unknown);
  const ring = usable.length > 0 ? usable : ofKind;
  if (ring.length === 0 || step === 0) return null;

  const at = ring.findIndex((exit) => exitKey(exit) === currentKey);
  const size = ring.length;
  const from = at === -1 ? (step > 0 ? -1 : 0) : at;
  const next = (((from + step) % size) + size) % size;
  return ring[next] ?? null;
}
