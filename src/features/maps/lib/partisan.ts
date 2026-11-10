import type { ProfileMode } from "@/features/progress-tracker/types";

/**
 * How Partisan's spawn chance works, shown on his boss card (and hinted at
 * on his pill) since the listed chance alone is misleading: in PvP and
 * Seasonal, low-karma PMCs in the raid push it up.
 *
 * Sources (checked 2026-11-07): BSG's own statement (quoted verbatim), the
 * wiki's Partisan and Karma pages (escapefromtarkov.fandom.com), and the
 * site owner's play experience for which karma losses weigh most (team
 * kills, then disconnects, then sitting still in bushes near hot spots).
 * tarkov.dev has no karma data at all.
 */
export const PARTISAN_INFO = {
  title: "How Partisan spawns",
  bsgStatement:
    "Please note that in PvP and Seasonal modes, the final chance depends on the presence of PMCs with low karma in the raid. The lower the karma, the higher the chance of Partisan appearing.",
  hunts:
    "He hunts low-karma PMCs, and low-karma Scavs too (karma, not Scav karma). He moves quietly, plants tripwires without setting any off, and can track a target across the whole map.",
  karmaIntro:
    "Karma is hidden and only exists in PvP and Seasonal. A distinct sound plays when it goes up or down.",
  lowers: [
    "Killing your own group members (the biggest drop)",
    "Disconnecting from a raid",
    "Staying still in bushes for a while, especially around hot spots",
  ],
  raises: [
    "Killing players who sat still in bushes",
    "Killing players who killed their own group members",
    "Using co-op extracts",
  ],
} as const;

/** Karma, and so this card's explanation, only applies in these modes. */
export function partisanKarmaApplies(mode: ProfileMode): boolean {
  return mode === "PVP" || mode === "PVP_SEASONAL";
}

/** Extra hover text for Partisan's pill, in the modes where karma matters. */
export const PARTISAN_PILL_HINT = "higher with low-karma PMCs in the raid";

/**
 * Where Partisan spawns, for his card: tarkov.dev lists no spawn zones for
 * him, and the wiki's Partisan page says he "has to be expected everywhere"
 * (checked 2026-11-07).
 */
export const PARTISAN_WHERE = "Roams the whole map";
