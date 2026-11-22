import { PROFILE_MODES, type ProfileMode } from "@/features/progress-tracker/types";

import {
  entryIdFor,
  TEAM_SIZES,
  type ActivityEntry,
  type Adjustment,
  type BuiltinColumnKey,
  type ColumnPoints,
  type EventDocument,
  type EventSettings,
  type Player,
  type RaidEntry,
  type ScoreColumn,
  type ScoreColumnKind,
  type Team,
  type TeamSize,
} from "../types";

import { MAX_RAIDS_PER_MODE } from "./defaults";

/**
 * Runtime validation for event data from anywhere untrusted: the Liveblocks
 * room (any edit-link holder can write to it directly), the viewer snapshot
 * route, and imported JSON files. The rule is to keep what's valid and drop
 * what isn't, per item: one malformed raid entry is skipped, it never
 * blanks the whole scoreboard. Only unusable settings (no name, no modes)
 * reject the whole document.
 */

/** Size limits, enforced on read and before the server creates an event. */
export const EVENT_LIMITS = {
  eventName: 80,
  teamName: 40,
  playerName: 32,
  columnLabel: 40,
  note: 200,
  reason: 120,
  activitySummary: 200,
  scorerName: 32,
  teams: 100,
  columns: 40,
  entries: 5000,
  adjustments: 1000,
  activity: 500,
  maxCount: 999,
  maxPoints: 10_000,
  maxMultiplier: 10,
} as const;

const BUILTIN_KEYS: ReadonlySet<string> = new Set<BuiltinColumnKey>([
  "pmcKills",
  "dogtags",
  "scavKills",
  "rogueGuardKills",
  "bossKills",
  "survived",
]);
const COLUMN_KINDS: ReadonlySet<string> = new Set<ScoreColumnKind>([
  "builtin",
  "custom",
  "item",
  "penalty",
]);
const MODE_SET: ReadonlySet<string> = new Set(PROFILE_MODES);
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;
// Control characters and zero-width/bidi formatting characters, which can
// hide text or flip its direction on the leaderboard.
const UNSAFE_CHARS = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁤﻿]/g;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Trims, strips control and invisible formatting characters, and caps the length. */
export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.normalize("NFC").replace(UNSAFE_CHARS, "").trim().slice(0, max);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function isMode(value: unknown): value is ProfileMode {
  return typeof value === "string" && MODE_SET.has(value);
}

function finiteIn(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function intIn(value: unknown, min: number, max: number): number | null {
  const n = finiteIn(value, min, max);
  return n !== null && Number.isInteger(n) ? n : null;
}

function parseModes(value: unknown): ProfileMode[] {
  if (!Array.isArray(value)) return [];
  // PROFILE_MODES order, deduplicated, so the UI always lists modes the same way.
  const present = new Set(value.filter(isMode));
  return PROFILE_MODES.filter((mode) => present.has(mode));
}

/** Parses event settings, or `null` when they can't describe an event (no name or no modes). */
export function parseSettings(value: unknown): EventSettings | null {
  if (!isRecord(value)) return null;
  const name = cleanText(value.name, EVENT_LIMITS.eventName);
  const modes = parseModes(value.modes);
  if (!name || modes.length === 0) return null;

  const teamSize = TEAM_SIZES.includes(value.teamSize as TeamSize)
    ? (value.teamSize as TeamSize)
    : 2;

  const raidsPerMode: Partial<Record<ProfileMode, number>> = {};
  const rawRaids = isRecord(value.raidsPerMode) ? value.raidsPerMode : {};
  for (const mode of modes) {
    raidsPerMode[mode] = intIn(rawRaids[mode], 1, MAX_RAIDS_PER_MODE) ?? 3;
  }

  const raidMultipliers: Partial<Record<ProfileMode, Record<string, number>>> = {};
  const rawMultipliers = isRecord(value.raidMultipliers) ? value.raidMultipliers : {};
  for (const mode of modes) {
    const perRaid = rawMultipliers[mode];
    if (!isRecord(perRaid)) continue;
    const clean: Record<string, number> = {};
    for (const [raid, factor] of Object.entries(perRaid)) {
      const raidNumber = Number(raid);
      const n = finiteIn(factor, 0, EVENT_LIMITS.maxMultiplier);
      if (Number.isInteger(raidNumber) && raidNumber >= 1 && n !== null && n !== 1) {
        clean[String(raidNumber)] = n;
      }
    }
    if (Object.keys(clean).length > 0) raidMultipliers[mode] = clean;
  }

  const tiebreakers = Array.isArray(value.tiebreakers)
    ? [...new Set(value.tiebreakers.filter(isId))].slice(0, 5)
    : [];

  return {
    name,
    modes,
    teamSize,
    raidsPerMode,
    scoringPerMode: value.scoringPerMode === true,
    leaderboard: value.leaderboard === "separate" ? "separate" : "combined",
    bestRaids: value.bestRaids === null ? null : intIn(value.bestRaids, 1, MAX_RAIDS_PER_MODE),
    raidMultipliers,
    tiebreakers,
  };
}

function parsePoints(value: unknown): ColumnPoints {
  const points: ColumnPoints = {};
  if (!isRecord(value)) return points;
  const max = EVENT_LIMITS.maxPoints;
  const all = finiteIn(value.all, -max, max);
  if (all !== null) points.all = all;
  for (const mode of PROFILE_MODES) {
    const n = finiteIn(value[mode], -max, max);
    if (n !== null) points[mode] = n;
  }
  return points;
}

/** Parses one score column, or `null` when it's malformed. */
export function parseColumn(value: unknown): ScoreColumn | null {
  if (!isRecord(value) || !isId(value.id)) return null;
  if (typeof value.kind !== "string" || !COLUMN_KINDS.has(value.kind)) return null;
  const kind = value.kind as ScoreColumnKind;
  const label = cleanText(value.label, EVENT_LIMITS.columnLabel);
  if (!label) return null;

  const column: ScoreColumn = {
    id: value.id,
    kind,
    label,
    points: parsePoints(value.points),
    enabled: value.enabled !== false,
  };
  if (kind === "builtin") {
    if (typeof value.builtin !== "string" || !BUILTIN_KEYS.has(value.builtin)) return null;
    column.builtin = value.builtin as BuiltinColumnKey;
  }
  if (kind === "item") {
    if (!isId(value.itemId)) return null;
    column.itemId = value.itemId;
  }
  return column;
}

function parsePlayer(value: unknown): Player | null {
  if (!isRecord(value) || !isId(value.id)) return null;
  return {
    id: value.id,
    name: cleanText(value.name, EVENT_LIMITS.playerName),
    roleId: isId(value.roleId) ? value.roleId : null,
  };
}

/** Parses one team, capping its roster at the event's team size. */
export function parseTeam(value: unknown, teamSize: TeamSize): Team | null {
  if (!isRecord(value) || !isId(value.id)) return null;
  const name = cleanText(value.name, EVENT_LIMITS.teamName);
  if (!name) return null;
  const players = Array.isArray(value.players)
    ? value.players
        .map(parsePlayer)
        .filter((player): player is Player => player !== null)
        .slice(0, teamSize)
    : [];
  return {
    id: value.id,
    name,
    order: finiteIn(value.order, 0, Number.MAX_SAFE_INTEGER) ?? 0,
    players,
  };
}

/** Parses one raid entry. Counts for unknown columns are kept (a re-enabled column gets its old counts back). */
export function parseEntry(value: unknown, modes: readonly ProfileMode[]): RaidEntry | null {
  if (!isRecord(value) || !isId(value.teamId) || !isMode(value.mode)) return null;
  if (!modes.includes(value.mode)) return null;
  const raid = intIn(value.raid, 1, MAX_RAIDS_PER_MODE);
  if (raid === null) return null;

  const counts: Record<string, number> = {};
  if (isRecord(value.counts)) {
    for (const [columnId, count] of Object.entries(value.counts)) {
      const n = intIn(count, 0, EVENT_LIMITS.maxCount);
      if (isId(columnId) && n !== null && n > 0) counts[columnId] = n;
    }
  }
  return {
    id: entryIdFor(value.teamId, value.mode, raid),
    teamId: value.teamId,
    mode: value.mode,
    raid,
    counts,
    note: cleanText(value.note, EVENT_LIMITS.note),
    updatedAt: finiteIn(value.updatedAt, 0, Number.MAX_SAFE_INTEGER) ?? 0,
  };
}

/** Parses one adjustment; a mode the event doesn't have becomes `null` (combined). */
export function parseAdjustment(value: unknown, modes: readonly ProfileMode[]): Adjustment | null {
  if (!isRecord(value) || !isId(value.id) || !isId(value.teamId)) return null;
  const points = finiteIn(value.points, -EVENT_LIMITS.maxPoints, EVENT_LIMITS.maxPoints);
  if (points === null || points === 0) return null;
  return {
    id: value.id,
    teamId: value.teamId,
    mode: isMode(value.mode) && modes.includes(value.mode) ? value.mode : null,
    points,
    reason: cleanText(value.reason, EVENT_LIMITS.reason),
    createdAt: finiteIn(value.createdAt, 0, Number.MAX_SAFE_INTEGER) ?? 0,
  };
}

function parseActivity(value: unknown): ActivityEntry | null {
  if (!isRecord(value)) return null;
  const summary = cleanText(value.summary, EVENT_LIMITS.activitySummary);
  const at = finiteIn(value.at, 0, Number.MAX_SAFE_INTEGER);
  if (!summary || at === null) return null;
  const entry: ActivityEntry = {
    at,
    by: cleanText(value.by, EVENT_LIMITS.scorerName) || "Someone",
    summary,
  };
  const key = cleanText(value.key, 120);
  if (key) entry.key = key;
  return entry;
}

function recordValues(value: unknown): unknown[] {
  if (value instanceof Map) return [...(value as Map<unknown, unknown>).values()];
  if (Array.isArray(value)) return value;
  return isRecord(value) ? Object.values(value) : [];
}

/**
 * Parses a whole event. `teams`, `entries` and `adjustments` may arrive as
 * plain objects (snapshot route, JSON file) or `Map`s (Liveblocks'
 * `useStorage` turns a `LiveMap` into a `ReadonlyMap`); both work. Entries
 * for deleted teams are dropped, and two entries for the same team, mode and
 * raid collapse into the newer one.
 */
export function parseEventDocument(value: unknown): EventDocument | null {
  if (!isRecord(value)) return null;
  const settings = parseSettings(value.settings);
  if (!settings) return null;

  const columns: ScoreColumn[] = [];
  const columnIds = new Set<string>();
  for (const raw of Array.isArray(value.columns) ? value.columns : []) {
    const column = parseColumn(raw);
    if (!column || columnIds.has(column.id)) continue;
    columnIds.add(column.id);
    columns.push(column);
    if (columns.length >= EVENT_LIMITS.columns) break;
  }

  const teams: Record<string, Team> = {};
  for (const raw of recordValues(value.teams).slice(0, EVENT_LIMITS.teams)) {
    const team = parseTeam(raw, settings.teamSize);
    if (team) teams[team.id] = team;
  }

  const entries: Record<string, RaidEntry> = {};
  for (const raw of recordValues(value.entries).slice(0, EVENT_LIMITS.entries)) {
    const entry = parseEntry(raw, settings.modes);
    if (!entry || !(entry.teamId in teams)) continue;
    const existing = entries[entry.id];
    if (!existing || existing.updatedAt <= entry.updatedAt) entries[entry.id] = entry;
  }

  const adjustments: Record<string, Adjustment> = {};
  for (const raw of recordValues(value.adjustments).slice(0, EVENT_LIMITS.adjustments)) {
    const adjustment = parseAdjustment(raw, settings.modes);
    if (adjustment && adjustment.teamId in teams) adjustments[adjustment.id] = adjustment;
  }

  const activity = (Array.isArray(value.activity) ? value.activity : [])
    .slice(-EVENT_LIMITS.activity)
    .map(parseActivity)
    .filter((entry): entry is ActivityEntry => entry !== null);

  return {
    version: 1,
    settings,
    columns,
    teams,
    entries,
    adjustments,
    activity,
  };
}
