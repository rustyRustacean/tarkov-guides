import { PROFILE_MODE_LABELS, type ProfileMode } from "@/features/progress-tracker/types";

import type {
  Adjustment,
  EventDocument,
  EventSettings,
  RaidEntry,
  ScoreColumn,
  Team,
} from "../types";

/**
 * Scoring for an event: pure functions from an {@link EventDocument} to
 * points and leaderboards. Nothing here is stored; every view recomputes it,
 * so changing a point value rescores every raid already logged, like editing
 * the Settings tab of the original spreadsheet.
 */

/** Rounds away floating point noise (e.g. 1.5 multipliers) to 2 decimals. */
function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** What one unit of `column` is worth in `mode`. Disabled columns are worth nothing. */
export function pointsFor(column: ScoreColumn, mode: ProfileMode, settings: EventSettings): number {
  if (!column.enabled) return 0;
  if (settings.scoringPerMode) return column.points[mode] ?? column.points.all ?? 0;
  return column.points.all ?? 0;
}

/** How many of `column` an entry scores. "Players survived" can't exceed the team size. */
export function countFor(entry: RaidEntry, column: ScoreColumn, settings: EventSettings): number {
  const count = entry.counts[column.id] ?? 0;
  return column.builtin === "survived" ? Math.min(count, settings.teamSize) : count;
}

/** The multiplier for a raid number in a mode (1 unless the organizer set one). */
export function multiplierFor(settings: EventSettings, mode: ProfileMode, raid: number): number {
  return settings.raidMultipliers[mode]?.[String(raid)] ?? 1;
}

/** One column's share of an entry's score. */
export interface ColumnScore {
  columnId: string;
  count: number;
  points: number;
  subtotal: number;
}

/** An entry's score: the per-column sum, then the raid multiplier. */
export interface EntryScore {
  base: number;
  multiplier: number;
  total: number;
  breakdown: ColumnScore[];
}

/** Scores one raid entry against the event's columns. */
export function scoreEntry(
  entry: RaidEntry,
  columns: readonly ScoreColumn[],
  settings: EventSettings,
): EntryScore {
  const breakdown: ColumnScore[] = [];
  let base = 0;
  for (const column of columns) {
    if (!column.enabled) continue;
    const count = countFor(entry, column, settings);
    const points = pointsFor(column, entry.mode, settings);
    const subtotal = count * points;
    base += subtotal;
    breakdown.push({ columnId: column.id, count, points, subtotal: round(subtotal) });
  }
  const multiplier = multiplierFor(settings, entry.mode, entry.raid);
  return { base: round(base), multiplier, total: round(base * multiplier), breakdown };
}

/** True when an entry's raid number is past its mode's raid count (left over after the count was lowered). Such entries don't score. */
export function isOutOfRange(entry: RaidEntry, settings: EventSettings): boolean {
  return entry.raid > (settings.raidsPerMode[entry.mode] ?? 0);
}

/** One team's line on a leaderboard. */
export interface LeaderboardRow {
  team: Team;
  /** Competition ranking (1, 2, 2, 4), after tiebreakers. */
  place: number;
  total: number;
  raidPoints: number;
  adjustmentPoints: number;
  raidsLogged: number;
  /** Per mode, the score of raid 1..N (`null` when not logged yet). */
  raidTotals: Partial<Record<ProfileMode, (number | null)[]>>;
  /** Per mode, whether raid 1..N counts toward the total (only `false` when best N drops it). */
  raidCounted: Partial<Record<ProfileMode, boolean[]>>;
  /** Points per mode from counted raids. */
  modeTotals: Partial<Record<ProfileMode, number>>;
  /** Units per column over the counted raids, e.g. total PMC kills. Drives the stat columns and tiebreakers. */
  columnTotals: Record<string, number>;
}

/** One ranked table: the whole event, or one mode when the modes are ranked separately. */
export interface Leaderboard {
  /** `"combined"` or the mode it ranks. */
  id: "combined" | ProfileMode;
  label: string;
  modes: ProfileMode[];
  rows: LeaderboardRow[];
}

/** What {@link buildLeaderboards} found while scoring that the organizer should know about. */
export interface ScoringNotes {
  /** Entries for raids past the mode's raid count, which don't score. */
  outOfRangeEntryIds: string[];
  /** Event-wide adjustments that no board counts, because each mode is ranked separately. */
  unassignedAdjustmentIds: string[];
}

/** True when every mode gets its own leaderboard. */
export function hasSeparateBoards(settings: EventSettings): boolean {
  return settings.modes.length > 1 && settings.leaderboard === "separate";
}

function adjustmentApplies(adjustment: Adjustment, board: Leaderboard["id"]): boolean {
  if (board === "combined") return true;
  return adjustment.mode === board;
}

function buildRow(
  team: Team,
  boardId: Leaderboard["id"],
  modes: readonly ProfileMode[],
  doc: EventDocument,
  entriesByTeam: ReadonlyMap<string, RaidEntry[]>,
): LeaderboardRow {
  const { settings, columns } = doc;
  const raidTotals: LeaderboardRow["raidTotals"] = {};
  const raidCounted: LeaderboardRow["raidCounted"] = {};
  const modeTotals: LeaderboardRow["modeTotals"] = {};
  const columnTotals: Record<string, number> = {};
  let raidPoints = 0;
  let raidsLogged = 0;

  const teamEntries = entriesByTeam.get(team.id) ?? [];
  for (const mode of modes) {
    const raidCount = settings.raidsPerMode[mode] ?? 0;
    const totals: (number | null)[] = Array.from({ length: raidCount }, () => null);
    const scored: { entry: RaidEntry; score: EntryScore }[] = [];
    for (const entry of teamEntries) {
      if (entry.mode !== mode || isOutOfRange(entry, settings)) continue;
      const score = scoreEntry(entry, columns, settings);
      totals[entry.raid - 1] = score.total;
      scored.push({ entry, score });
    }
    raidsLogged += scored.length;

    // Best N: keep the highest-scoring raids; ties go to the earlier raid.
    const ranked = [...scored].sort(
      (a, b) => b.score.total - a.score.total || a.entry.raid - b.entry.raid,
    );
    const keep = settings.bestRaids === null ? ranked : ranked.slice(0, settings.bestRaids);
    const keptRaids = new Set(keep.map(({ entry }) => entry.raid));
    const counted = Array.from(
      { length: raidCount },
      (_, i) => totals[i] === null || keptRaids.has(i + 1),
    );

    let modeTotal = 0;
    for (const { score } of keep) {
      modeTotal += score.total;
      for (const { columnId, count } of score.breakdown) {
        columnTotals[columnId] = (columnTotals[columnId] ?? 0) + count;
      }
    }
    raidTotals[mode] = totals;
    raidCounted[mode] = counted;
    modeTotals[mode] = round(modeTotal);
    raidPoints += modeTotal;
  }

  let adjustmentPoints = 0;
  for (const adjustment of Object.values(doc.adjustments)) {
    if (adjustment.teamId === team.id && adjustmentApplies(adjustment, boardId)) {
      adjustmentPoints += adjustment.points;
    }
  }

  return {
    team,
    place: 0,
    total: round(raidPoints + adjustmentPoints),
    raidPoints: round(raidPoints),
    adjustmentPoints: round(adjustmentPoints),
    raidsLogged,
    raidTotals,
    raidCounted,
    modeTotals,
    columnTotals,
  };
}

/** Orders rows by total, then each tiebreaker column (more is better), and assigns competition places. */
export function rankRows(
  rows: readonly LeaderboardRow[],
  tiebreakers: readonly string[],
): LeaderboardRow[] {
  const compare = (a: LeaderboardRow, b: LeaderboardRow): number => {
    if (b.total !== a.total) return b.total - a.total;
    for (const key of tiebreakers) {
      const diff = (b.columnTotals[key] ?? 0) - (a.columnTotals[key] ?? 0);
      if (diff !== 0) return diff;
    }
    return 0;
  };
  const sorted = [...rows].sort((a, b) => compare(a, b) || a.team.name.localeCompare(b.team.name));
  let place = 0;
  return sorted.map((row, index) => {
    const previous = sorted[index - 1];
    if (!previous || compare(previous, row) !== 0) place = index + 1;
    return { ...row, place };
  });
}

/**
 * The event's leaderboards: one for the whole event, or one per mode when
 * the modes are ranked separately. Every team is listed, even before its
 * first raid.
 */
export function buildLeaderboards(doc: EventDocument): {
  boards: Leaderboard[];
  notes: ScoringNotes;
} {
  const { settings } = doc;
  const teams = Object.values(doc.teams).sort((a, b) => a.order - b.order);
  const entriesByTeam = new Map<string, RaidEntry[]>();
  const outOfRangeEntryIds: string[] = [];
  for (const entry of Object.values(doc.entries)) {
    if (isOutOfRange(entry, settings)) outOfRangeEntryIds.push(entry.id);
    const list = entriesByTeam.get(entry.teamId);
    if (list) list.push(entry);
    else entriesByTeam.set(entry.teamId, [entry]);
  }

  const separate = hasSeparateBoards(settings);
  const specs: { id: Leaderboard["id"]; label: string; modes: ProfileMode[] }[] = separate
    ? settings.modes.map((mode) => ({ id: mode, label: PROFILE_MODE_LABELS[mode], modes: [mode] }))
    : [{ id: "combined", label: "Overall", modes: settings.modes }];

  const boards = specs.map(({ id, label, modes }) => ({
    id,
    label,
    modes,
    rows: rankRows(
      teams.map((team) => buildRow(team, id, modes, doc, entriesByTeam)),
      settings.tiebreakers,
    ),
  }));

  const unassignedAdjustmentIds = separate
    ? Object.values(doc.adjustments)
        .filter((adjustment) => adjustment.mode === null)
        .map((adjustment) => adjustment.id)
    : [];

  return { boards, notes: { outOfRangeEntryIds, unassignedAdjustmentIds } };
}
