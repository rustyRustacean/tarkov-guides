/**
 * What `persistOptions.buster` in `src/app/providers.tsx` is built from. React
 * Query discards a persisted cache whose buster doesn't match, so a returning
 * visitor's browser never renders game data saved under an older shape.
 *
 * The buster is `v{revision}-{typesFingerprint}`:
 *
 * - `typesFingerprint` tracks the shape. It is a hash of `types.ts` (which
 *   defines `RawTarkovApiResponseData`, the payload the cache holds), ignoring
 *   comments and whitespace. `cache-version.test.ts` recomputes it and fails
 *   with the new value whenever the types change, so a shape change can't ship
 *   under an old buster. It also makes two branches that each change the
 *   shape produce different busters even when both pick the same `revision`:
 *   that collision (two branches bumping `v6` to `v7` for different shapes,
 *   merged silently by git) is what #60 fixed. A merge of both changes matches
 *   neither branch's fingerprint, so the test fails until it is updated.
 * - `revision` is bumped by hand for a change the types don't show: the same
 *   shape with different meaning or a different data source.
 *
 * History (the old hand-bumped `vN` strings, kept for context):
 * - `v5`: maps carry `extracts`/`transits` (the exit list snip).
 * - `v6`: maps carry `hazards` (minefield polygons for the exit path).
 * - `v7`: `main` had reached `v6` separately for the boss loadout `mobs`
 *   section (#38), so this stack went one past it.
 * - `v8`: boss spawns carry `escorts`, and `mobs` includes every guard (#42);
 *   that branch had also picked `v7`, so it went one past again.
 * - `v9`: each mode's tasks, flea prices and boss rosters (#40).
 * - `v10`: boss spawn zones, timing, switch triggers and spawn spots (#40).
 */
export const GAME_DATA_CACHE_VERSION = {
  revision: 10,
  typesFingerprint: "d13d96159210",
} as const;

export const QUERY_CACHE_BUSTER = `v${String(GAME_DATA_CACHE_VERSION.revision)}-${GAME_DATA_CACHE_VERSION.typesFingerprint}`;
