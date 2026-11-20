import { PROFILE_MODE_LABELS } from "@/features/progress-tracker/types";

import type { HostedResource } from "../data/resources";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/**
 * `"2026-11"` as `"November 2026"`. Parsed by hand rather than through
 * `Date`, so the server and the browser can't disagree across time zones.
 * Returns the input unchanged when it isn't `YYYY-MM`.
 */
export function formatCheckedMonth(checked: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(checked);
  const month = match ? MONTH_NAMES[Number(match[2]) - 1] : undefined;
  return match && month ? `${month} ${match[1] ?? ""}` : checked;
}

/** Badge text for which modes a resource covers, e.g. "Seasonal only" or "PvP and PvE". */
export function formatResourceModes(modes: HostedResource["modes"]): string {
  if (modes === "all") return "Follows your game mode";
  const labels = modes.map((mode) => PROFILE_MODE_LABELS[mode]);
  if (labels.length === 1) return `${labels[0] ?? ""} only`;
  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1) ?? ""}`;
}
