import type {
  BuiltinColumnKey,
  EventDocument,
  EventSettings,
  Preset,
  ScoreColumn,
  TeamSize,
} from "../types";
import type { ProfileMode } from "@/features/progress-tracker/types";

/**
 * The starting columns, in raid log order. Points come from the organizer's
 * own event spreadsheet (PMC kill 5, dogtag 1, rogue/guard kill 3, boss kill
 * 7, 5 per player extracted). Scav kills weren't in that sheet; 1 point is a
 * starting guess the organizer is expected to change.
 */
const BUILTIN_COLUMNS: readonly { key: BuiltinColumnKey; label: string; points: number }[] = [
  { key: "pmcKills", label: "PMC kills", points: 5 },
  { key: "dogtags", label: "Dogtags", points: 1 },
  { key: "scavKills", label: "Scav kills", points: 1 },
  { key: "rogueGuardKills", label: "Rogue / guard kills", points: 3 },
  { key: "bossKills", label: "Boss kills", points: 7 },
  { key: "survived", label: "Players survived", points: 5 },
];

/** Raids per team per mode, matching the spreadsheet's 3. */
export const DEFAULT_RAIDS_PER_MODE = 3;

/** The most raids a mode can be set to. */
export const MAX_RAIDS_PER_MODE = 20;

/** A random id for a team, player, column or adjustment. Not a secret, just unique. */
export function newId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
}

/** The default columns, with fresh ids. Builtin ids are their key, so tiebreakers can name them before any edit. */
export function defaultColumns(): ScoreColumn[] {
  return BUILTIN_COLUMNS.map(({ key, label, points }) => ({
    id: key,
    kind: "builtin",
    builtin: key,
    label,
    points: { all: points },
    enabled: true,
  }));
}

/** Settings a new event starts with. */
export function defaultSettings(
  name: string,
  modes: readonly ProfileMode[] = ["PVP"],
  teamSize: TeamSize = 2,
): EventSettings {
  const raidsPerMode: Partial<Record<ProfileMode, number>> = {};
  for (const mode of modes) raidsPerMode[mode] = DEFAULT_RAIDS_PER_MODE;
  return {
    name,
    modes: [...modes],
    teamSize,
    raidsPerMode,
    scoringPerMode: false,
    leaderboard: "combined",
    bestRaids: null,
    raidMultipliers: {},
    tiebreakers: ["survived", "pmcKills"],
  };
}

/** A complete, empty event document. */
export function emptyEventDocument(settings: EventSettings): EventDocument {
  return {
    version: 1,
    settings,
    columns: defaultColumns(),
    teams: {},
    entries: {},
    adjustments: {},
    presets: {},
    activity: [],
  };
}

/** A new, empty preset. */
export function blankPreset(name = "New preset"): Preset {
  return { id: newId(), name, description: "", rules: [] };
}
