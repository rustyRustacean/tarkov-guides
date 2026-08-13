/**
 * Live in-game Tarkov clock formula, ported verbatim from
 * `old/TarkovTrackerWB-main/src/components/maps/mapHeader.js`'s
 * `tarkovClock`. Confirmed byte-for-byte against adamburgess/tarkov-time's
 * live `src/time.ts`: same 7x ratio, same +3h Moscow anchor, same +12h
 * right-side split. Not a porting bug.
 *
 * `Date.now()` is UTC ms since epoch; in-game time runs 7x real time and is
 * anchored to Moscow (UTC+3) rather than epoch-zero being in-game midnight.
 * Without that +3h offset the displayed clock drifts ~3h from what the
 * player actually sees in-raid. No further timezone math is needed since
 * `Date.now()` is already timezone-independent, so this works identically
 * regardless of the player's own local timezone.
 *
 *   tarkovTime = (3h + sideOffset + calibration + Date.now() × 7) mod 24h
 *
 * `"right"` adds a further 12h offset, showing a second live clock exactly
 * half a Tarkov day ahead of `"left"`, ported as-is; legacy shows both
 * side by side without further explanation of the use case beyond "the two
 * current in-world times, 12 hours apart."
 *
 * This formula is anchored to the Unix epoch (1970), not to any live
 * signal: tarkov.dev's API has no "current in-game time" field to sync
 * against, and BSG has changed the real acceleration ratio across game
 * history (4:1 in 2017, ~7.5:1 in 2019, settling on 7:1 later per the
 * official forum). A pure epoch-anchored formula has no way to self-correct
 * if the true ratio ever isn't *exactly* 7: any tiny deviation compounds
 * over the decades since epoch into a visible, permanent offset.
 * `TARKOV_CLOCK_CALIBRATION_OFFSET_MS` below exists to absorb exactly that
 * drift.
 *
 * **Re-calibrating this constant** (if the displayed clock ever drifts from
 * the real in-raid clock again): at the same real-world instant, note both
 * the app's displayed `left` time and your actual in-raid clock time, take
 * (actual − displayed) in minutes, and add that many minutes' worth of ms
 * to the constant below (it's additive with whatever's already there since
 * the drift only ever grows in one direction over time).
 */
const TARKOV_TIME_RATIO = 7;
const TARKOV_DAY_MS = 24 * 60 * 60 * 1000;
const TARKOV_RIGHT_OFFSET_MS = 12 * 60 * 60 * 1000;
const TARKOV_MOSCOW_OFFSET_MS = 3 * 60 * 60 * 1000;
/**
 * Empirical correction for epoch-anchored drift (see module doc above):
 * the displayed clock read 05:26/17:26 while the actual in-raid clock read
 * ~05:37/17:37, an 11-minute gap. See the module doc's "Re-calibrating this
 * constant" section before changing this value.
 */
const TARKOV_CLOCK_CALIBRATION_OFFSET_MS = 11 * 60 * 1000;

export type TarkovClockSide = "left" | "right";

/** `now` defaults to `Date.now()`, overridable purely so this stays a pure, deterministically-testable function. */
export function tarkovClock(side: TarkovClockSide, now: number = Date.now()): string {
  const sideOffset = side === "right" ? TARKOV_RIGHT_OFFSET_MS : 0;
  const offset = TARKOV_MOSCOW_OFFSET_MS + TARKOV_CLOCK_CALIBRATION_OFFSET_MS + sideOffset;
  let ms = (offset + now * TARKOV_TIME_RATIO) % TARKOV_DAY_MS;
  if (ms < 0) ms += TARKOV_DAY_MS; // JS `%` can return negative for a negative dividend; normalize.
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
