import type { ProfileMode } from "@/features/progress-tracker/types";

/**
 * The shapes an event is stored in. Everything here is plain JSON (no
 * `Map`, `Date` or class instances), so the same values round-trip through
 * Liveblocks Storage, the viewer snapshot route and a JSON export without
 * conversion. Every reader still runs them through `parseEventDocument`
 * (`lib/event-schema.ts`), since anyone holding an edit link can write to
 * the room directly.
 */

/** A team of 1 (solo) to 5 (5-stack) players. */
export type TeamSize = 1 | 2 | 3 | 4 | 5;

/** Every allowed {@link TeamSize}, smallest first. */
export const TEAM_SIZES: readonly TeamSize[] = [1, 2, 3, 4, 5];

/** How each team size is named in Tarkov communities. */
export const TEAM_SIZE_LABELS: Readonly<Record<TeamSize, string>> = {
  1: "Solo",
  2: "Duo",
  3: "Trio",
  4: "Quad",
  5: "5-stack",
};

/** The default score columns every event starts with, before the organizer edits points or adds their own. */
export type BuiltinColumnKey =
  "pmcKills" | "dogtags" | "scavKills" | "rogueGuardKills" | "bossKills" | "survived";

/**
 * What a score column counts:
 * - `builtin`: one of the {@link BuiltinColumnKey} defaults.
 * - `custom`: anything the organizer names (e.g. "Labs keycards used").
 * - `item`: a specific item extracted (e.g. Bitcoin, +10 each), shown with its icon.
 * - `penalty`: something that costs points (e.g. "Rule break"); its points are negative.
 */
export type ScoreColumnKind = "builtin" | "custom" | "item" | "penalty";

/**
 * Points per counted unit. `all` applies when the event scores every mode
 * the same; per-mode values apply when `scoringPerMode` is on, falling back
 * to `all` for a mode left blank.
 */
export type ColumnPoints = { all?: number } & Partial<Record<ProfileMode, number>>;

/** One counted thing on the raid log, and what each one is worth. */
export interface ScoreColumn {
  id: string;
  kind: ScoreColumnKind;
  /** Set when `kind` is `builtin`. */
  builtin?: BuiltinColumnKey;
  label: string;
  /** The tarkov.dev item id when `kind` is `item`. */
  itemId?: string;
  points: ColumnPoints;
  /** A disabled column stays in the data (old entries keep their counts) but is hidden and scores nothing. */
  enabled: boolean;
}

/** How several modes' raids are ranked. */
export type LeaderboardMode = "combined" | "separate";

/**
 * Breaks ties on total points, in order: `survived` (most players
 * extracted) or a column id (most of that column, e.g. most PMC kills).
 */
export type TiebreakerKey = string;

/** Event-wide settings: what's being played and how it's scored. */
export interface EventSettings {
  name: string;
  /** At least one; any mix of PvP, Seasonal and PvE. */
  modes: ProfileMode[];
  teamSize: TeamSize;
  /** How many raids each team plays in each mode. */
  raidsPerMode: Partial<Record<ProfileMode, number>>;
  /** When on, each column can be worth different points per mode (e.g. PvE PMC kills worth less). */
  scoringPerMode: boolean;
  /** Only matters when the event has more than one mode. */
  leaderboard: LeaderboardMode;
  /** When set, only each team's best N raids per mode count toward the total. */
  bestRaids: number | null;
  /** Multiplier for a raid number in a mode, e.g. `{ PVP: { "3": 2 } }` makes PvP raid 3 count double. Missing means 1. */
  raidMultipliers: Partial<Record<ProfileMode, Record<string, number>>>;
  tiebreakers: TiebreakerKey[];
}

/** One player on a team's roster. */
export interface Player {
  id: string;
  name: string;
  /** The role preset this player follows (Stage 2), or `null` for none. */
  roleId: string | null;
}

/** A team and its roster. */
export interface Team {
  id: string;
  name: string;
  /** Sort key for display order: creation order. */
  order: number;
  players: Player[];
}

/**
 * One team's result in one raid of one mode: a count per column. Its id is
 * always {@link entryIdFor} of its team, mode and raid, so two scorers
 * filling the same raid write the same entry instead of creating duplicates.
 */
export interface RaidEntry {
  id: string;
  teamId: string;
  mode: ProfileMode;
  /** 1-based raid number. */
  raid: number;
  /** Count per column id. Missing means 0. */
  counts: Record<string, number>;
  note: string;
  /** Epoch ms of the last change. */
  updatedAt: number;
}

/** A one-off bonus or deduction for a team, outside any raid (e.g. -10 for a rule break). */
export interface Adjustment {
  id: string;
  teamId: string;
  /** The mode's leaderboard it applies to; `null` means the combined leaderboard. */
  mode: ProfileMode | null;
  points: number;
  reason: string;
  createdAt: number;
}

/** One line in the editors' activity log. */
export interface ActivityEntry {
  at: number;
  /** The display name the scorer entered. Not verified: anyone with the edit link picks their own. */
  by: string;
  summary: string;
  /** Groups rapid repeat edits of one thing (e.g. clicking a count up five times) into a single line. */
  key?: string;
}

/** A whole event, in the plain shape every reader works with. */
export interface EventDocument {
  version: 1;
  settings: EventSettings;
  columns: ScoreColumn[];
  teams: Record<string, Team>;
  entries: Record<string, RaidEntry>;
  adjustments: Record<string, Adjustment>;
  activity: ActivityEntry[];
}

/** The deterministic id for a team's entry in a given mode and raid. See {@link RaidEntry}. */
export function entryIdFor(teamId: string, mode: ProfileMode, raid: number): string {
  return `${teamId}:${mode}:${String(raid)}`;
}
