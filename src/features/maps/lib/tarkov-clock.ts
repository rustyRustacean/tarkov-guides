/**
 * Live in-game Tarkov clock formula - ported verbatim from
 * `old/TarkovTrackerWB-main/src/components/maps/mapHeader.js`'s
 * `tarkovClock`, itself matching adamburgess/tarkov-time's canonical
 * reference formula (`src/time.ts`).
 *
 * `Date.now()` is UTC ms since epoch; in-game time runs 7x real time and is
 * anchored to Moscow (UTC+3) rather than epoch-zero being in-game midnight -
 * without that +3h offset the displayed clock drifts ~3h from what the
 * player actually sees in-raid. No further timezone math is needed since
 * `Date.now()` is already timezone-independent - this works identically
 * regardless of the player's own local timezone.
 *
 *   tarkovTime = (3h + sideOffset + Date.now() × 7) mod 24h
 *
 * `"right"` adds a further 12h offset, showing a second live clock exactly
 * half a Tarkov day ahead of `"left"` - ported as-is; legacy shows both
 * side by side without further explanation of the use case beyond "the two
 * current in-world times, 12 hours apart."
 */
const TARKOV_TIME_RATIO = 7;
const TARKOV_DAY_MS = 24 * 60 * 60 * 1000;
const TARKOV_RIGHT_OFFSET_MS = 12 * 60 * 60 * 1000;
const TARKOV_MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;

export type TarkovClockSide = "left" | "right";

/** `now` defaults to `Date.now()` - overridable purely so this stays a pure, deterministically-testable function. */
export function tarkovClock(side: TarkovClockSide, now: number = Date.now()): string {
  const sideOffset = side === "right" ? TARKOV_RIGHT_OFFSET_MS : 0;
  const offset = TARKOV_MOSCOW_OFFSET_MS + sideOffset;
  let ms = (offset + now * TARKOV_TIME_RATIO) % TARKOV_DAY_MS;
  if (ms < 0) ms += TARKOV_DAY_MS; // JS `%` can return negative for a negative dividend - normalize.
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
