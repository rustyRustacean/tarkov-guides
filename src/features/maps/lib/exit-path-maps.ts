/**
 * Maps where the exit path controls are not offered at all: there is no
 * reliable walkability data for them (no walkable mesh, and Terminal's
 * obstacle layers are too thin to route on).
 */
const NO_EXIT_PATH: ReadonlySet<string> = new Set(["terminal", "icebreaker"]);

/** Whether the exit path (Go to Exit, Show all exits, tester) is available on this map tab. */
export function exitPathAvailable(normalizedName: string): boolean {
  return !NO_EXIT_PATH.has(normalizedName);
}
