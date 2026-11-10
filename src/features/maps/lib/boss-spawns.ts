import { toneFor } from "./boss-groups";

import type { BossBadge, BossPill, BossPillTone, BossSpawn } from "./boss-groups";
import type { RawGroundPoint, RawSquadSizeChance } from "@/shared/lib/tarkov-api/types";

// Where and when bosses spawn, derived from each pill's `spawns` (see
// `boss-groups.ts`): the boss card's "Where and when" lines, the possible
// spawn spots its "Show on map" draws, and the map's Spawn timeline.

/** A time into the raid as minutes and seconds ("0:03", "15:00"), with minutes not capped at 60 ("96:30"). */
export function formatRaidClock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  return `${String(minutes)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Whether `seconds` into the raid is past a raid of `raidMinutes` (never, when the length is unknown). */
export function isPastRaid(seconds: number, raidMinutes: number | null): boolean {
  return raidMinutes !== null && raidMinutes > 0 && seconds > raidMinutes * 60;
}

/** "Reshala's", "Raiders'". */
export function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

/** Names in a sentence: "Dorms", "Dorms and New Gas Station", "A, B and C". */
export function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1) ?? ""}`;
}

/** A zone behind a pill, for the card's "Where" line. */
export interface ZoneChance {
  name: string;
  /** The 0..1 chance of this zone when the pill's only spawn happens; `null` when the pill has several spawns (see {@link summarizeZones}). */
  chance: number | null;
}

/**
 * The zones behind a pill, likeliest first and then by name. With one spawn,
 * each zone keeps its chance when that spawn happens (Reshala on Customs:
 * Dorms, New Gas Station and Stronghold, 33% each). With several spawns
 * (Raiders on Labs have 16), each spawn's zone figures are its own, and
 * most name a single zone, so a merged percentage would just read "100%"
 * everywhere. Those zones come without a chance instead, ordered by the best
 * odds of any one spawn landing there (its own chance times the zone's);
 * the Spawn timeline gives each spawn's figures.
 */
export function summarizeZones(spawns: readonly BossSpawn[]): readonly ZoneChance[] {
  const withZones = spawns.filter((spawn) => spawn.zones.length > 0);
  const [only] = withZones;
  if (only && withZones.length === 1) {
    return only.zones
      .map((zone) => ({ name: zone.name, chance: zone.chance }))
      .sort((a, b) => b.chance - a.chance || a.name.localeCompare(b.name));
  }
  const best = new Map<string, number>();
  for (const spawn of withZones) {
    for (const zone of spawn.zones) {
      best.set(zone.name, Math.max(best.get(zone.name) ?? 0, spawn.chance * zone.chance));
    }
  }
  return [...best]
    .sort(([nameA, a], [nameB, b]) => b - a || nameA.localeCompare(nameB))
    .map(([name]) => ({ name, chance: null }));
}

/**
 * When a pill's spawns can happen, as one line on the card. `from` is a
 * single shared timer; `triggered` (any spawn a switch triggers) and
 * `several` (spawns on different timings, like Terminal's waves) are only
 * laid out on the Spawn timeline.
 */
export type TimingSummary =
  | { kind: "start" }
  | { kind: "random" }
  | { kind: "from"; seconds: number }
  | { kind: "scripted" }
  | { kind: "triggered" }
  | { kind: "several" };

/** A pill's timing as one {@link TimingSummary}, or `null` when none of its spawns has a time. */
export function summarizeTiming(spawns: readonly BossSpawn[]): TimingSummary | null {
  if (spawns.some((spawn) => spawn.trigger !== null)) return { kind: "triggered" };
  const timings = spawns.flatMap((spawn) => (spawn.timing ? [spawn.timing] : []));
  const [first] = timings;
  if (!first) return null;
  const allSame = timings.every(
    (timing) =>
      timing.kind === first.kind &&
      (timing.kind !== "timed" || (first.kind === "timed" && timing.seconds === first.seconds)),
  );
  if (!allSame) return { kind: "several" };
  return first.kind === "timed" ? { kind: "from", seconds: first.seconds } : first;
}

/** The card's "When" line for a pill's timing. */
export function describeTiming(timing: TimingSummary, raidMinutes: number | null): string {
  switch (timing.kind) {
    case "start":
      return "At raid start";
    case "random":
      return "At a random time during the raid";
    case "from":
      return `Can appear from ${formatRaidClock(timing.seconds)}${
        isPastRaid(timing.seconds, raidMinutes)
          ? `, after the ${String(raidMinutes)} min raid ends`
          : ""
      }`;
    case "scripted":
      return "Scripted, not on a timer";
    case "triggered":
      return "Some spawns are triggered by switches";
    case "several":
      return "Spawns at several different times";
  }
}

/** Whether a timing is one only the Spawn timeline can lay out, so the card points there. */
export function timingNeedsTimeline(timing: TimingSummary): boolean {
  return timing.kind === "triggered" || timing.kind === "several";
}

/** One possible spawn spot, with the zone it belongs to. */
export interface BossSpawnSpot extends RawGroundPoint {
  zone: string;
}

/** A pill's possible spawn spots, and which of its zones have none in the data. */
export interface PillSpawnSpots {
  /** Deduplicated across the pill's spawns and zones. */
  spots: readonly BossSpawnSpot[];
  /** Zone names the pill can use that list no spots, highest chance first (Reshala's Dorms and New Gas Station). */
  zonesWithoutSpots: readonly string[];
}

/** Every possible spawn spot behind a pill, for "Show on map". */
export function spawnSpotsFor(pill: Pick<BossPill, "spawns">): PillSpawnSpots {
  const spots: BossSpawnSpot[] = [];
  const seen = new Set<string>();
  const zonesWithSpots = new Set<string>();
  for (const spawn of pill.spawns) {
    for (const zone of spawn.zones) {
      for (const spot of zone.spots) {
        zonesWithSpots.add(zone.name);
        const id = `${String(spot.x)}|${String(spot.z)}`;
        if (seen.has(id)) continue;
        seen.add(id);
        spots.push({ x: spot.x, z: spot.z, zone: zone.name });
      }
    }
  }
  return {
    spots,
    zonesWithoutSpots: summarizeZones(pill.spawns)
      .map((zone) => zone.name)
      .filter((name) => !zonesWithSpots.has(name)),
  };
}

/**
 * Whether any spawn behind `pills` is on a timer, comes at a random time, or
 * is triggered by a switch: what the Spawn timeline shows beyond raid start.
 * Scripted spawns don't count, since the timeline leaves them out.
 */
export function hasSpawnTimeline(pills: readonly Pick<BossPill, "spawns">[]): boolean {
  return pills.some((pill) =>
    pill.spawns.some(
      (spawn) =>
        spawn.trigger !== null || spawn.timing?.kind === "timed" || spawn.timing?.kind === "random",
    ),
  );
}

/**
 * What the Spawn timeline says about triggers tarkov.dev's data names no
 * switch for, per map entry. Only Labs has any (checked 2026-11-08): the
 * trigger ids `autoId_00012_EXFIL` and `autoId_00009_EXFIL` mark extract
 * switches, and the wiki says any Labs extract switch can bring Raiders,
 * but neither says which two these are. The Cargo Elevator, Hangar Gate and
 * Parking Gate switches are named, which leaves the extracts listed here
 * (from the site owner's list of Labs extracts).
 */
const UNNAMED_SWITCHES: Readonly<Record<string, { title: string; note: string }>> = {
  "the-lab": {
    title: "Other extract switches",
    note: "tarkov.dev's data doesn't name these switches. Their ids mark them as extract switches, and the Labs extracts not named above are Main Elevator, Medical Block Elevator, Ventilation Shaft and Sewage Conduit.",
  },
};

const UNNAMED_SWITCHES_ELSEWHERE = {
  title: "Unnamed switches",
  note: "tarkov.dev's data doesn't name these switches.",
};

/** The heading and note for the Spawn timeline's group of unnamed switch triggers on a map entry. */
export function unnamedSwitchesFor(mapEntry: string): { title: string; note: string } {
  return UNNAMED_SWITCHES[mapEntry] ?? UNNAMED_SWITCHES_ELSEWHERE;
}

/**
 * One enemy on the Spawn timeline: one spawn on a timer or a switch, or, in
 * the random-time and raid-start lists, all of a pill's spawns merged.
 */
export interface TimelineSubject {
  name: string;
  imagePortraitLink: string | null;
  /** The threat tone for this subject's own chance (not the pill's highest). */
  tone: BossPillTone;
  /** The pill's corner glyph (night only, Halloween event), when it has one. */
  badge?: BossBadge;
  /** The pill's chance qualifier (Partisan's karma, in PvP and Seasonal), when it has one. */
  note?: string;
  /** The 0..1 chance this spawn happens (the highest, when merged). */
  chance: number;
  /** How many spawn together, for a faction. */
  groupSize: readonly RawSquadSizeChance[] | null;
  /** Zone names, likeliest first. */
  zones: readonly string[];
}

/** Everything due at one time into the raid. */
export interface TimelineRow {
  seconds: number;
  /** Past the raid's own length (Terminal's visiting bosses at 96:30 in a 50 min raid). */
  pastRaid: boolean;
  subjects: readonly TimelineSubject[];
}

/** A spawn one switch can trigger. */
export interface TriggeredSubject extends TimelineSubject {
  /** A time upstream pairs with this trigger, shown as-is since what the game does with it isn't documented; `null` when none. */
  linkedSeconds: number | null;
}

/** What one switch can trigger. */
export interface TriggerGroup {
  /** `null` for the triggers tarkov.dev's data names no switch for (see {@link unnamedSwitchesFor}). */
  switchName: string | null;
  subjects: readonly TriggeredSubject[];
}

/** A map's spawns laid out by when they can happen. Scripted spawns and spawns with no time are left out. */
export interface SpawnTimeline {
  /** On a timer, earliest first. */
  timed: readonly TimelineRow[];
  /** At a random time in the raid (the Goons), one per pill. */
  random: readonly TimelineSubject[];
  /** Grouped by switch in upstream's order, the unnamed group last. */
  triggered: readonly TriggerGroup[];
  /** One per pill. */
  atStart: readonly TimelineSubject[];
}

function subjectOf(pill: BossPill, spawns: readonly BossSpawn[]): TimelineSubject {
  const chance = Math.max(0, ...spawns.map((spawn) => spawn.chance));
  return {
    name: pill.name,
    imagePortraitLink: pill.imagePortraitLink,
    tone: toneFor(chance),
    ...(pill.badge ? { badge: pill.badge } : {}),
    ...(pill.note ? { note: pill.note } : {}),
    chance,
    groupSize: spawns.find((spawn) => spawn.groupSize !== null)?.groupSize ?? null,
    zones: summarizeZones(spawns).map((zone) => zone.name),
  };
}

/** Whether two triggered lines say exactly the same thing. */
function sameLine(a: TriggeredSubject, b: TriggeredSubject): boolean {
  return (
    a.name === b.name &&
    a.chance === b.chance &&
    a.linkedSeconds === b.linkedSeconds &&
    a.zones.join("|") === b.zones.join("|") &&
    JSON.stringify(a.groupSize) === JSON.stringify(b.groupSize)
  );
}

/** The value at `key`, created on first use, so keys keep first-seen order. */
function slot<K, V>(map: Map<K, V>, key: K, create: () => V): V {
  const existing = map.get(key);
  if (existing !== undefined) return existing;
  const created = create();
  map.set(key, created);
  return created;
}

/**
 * Lays out the spawns behind a map's pills by when they can happen. Each
 * spawn on a timer or a switch is its own line, since each has its own
 * chance and zones (the Cargo Elevator Power Button on Labs can bring one
 * group of Raiders to the Basement at 40% and another to the Second Floor
 * at 45%), except that the unnamed switches list a repeated spawn once. The
 * random-time and raid-start lists are summaries, one line per pill. Lines
 * keep the strip's order, likeliest pill first. A triggered
 * spawn with a time keeps it as `linkedSeconds` rather than appearing on the
 * timer. Times past the raid's length are flagged, not dropped.
 */
export function buildSpawnTimeline(
  pills: readonly BossPill[],
  raidMinutes: number | null,
): SpawnTimeline {
  const timed = new Map<number, TimelineSubject[]>();
  const triggered = new Map<string | null, TriggeredSubject[]>();
  const random: TimelineSubject[] = [];
  const atStart: TimelineSubject[] = [];

  for (const pill of pills) {
    const randomSpawns: BossSpawn[] = [];
    const startSpawns: BossSpawn[] = [];
    for (const spawn of pill.spawns) {
      const { timing, trigger } = spawn;
      if (trigger) {
        const line = {
          ...subjectOf(pill, [spawn]),
          linkedSeconds: timing?.kind === "timed" ? timing.seconds : null,
        };
        const lines = slot(triggered, trigger.switchName, (): TriggeredSubject[] => []);
        // The unnamed group can't tell its switches apart, so the same spawn
        // from two of them would only repeat (each of the two unnamed Labs
        // switches lists a 35% group for the First Floor and one for the
        // Second). Under a named switch, a repeat is another roll, so it stays.
        if (trigger.switchName !== null || !lines.some((other) => sameLine(other, line))) {
          lines.push(line);
        }
      } else if (timing?.kind === "timed") {
        slot(timed, timing.seconds, () => []).push(subjectOf(pill, [spawn]));
      } else if (timing?.kind === "random") {
        randomSpawns.push(spawn);
      } else if (timing?.kind === "start") {
        startSpawns.push(spawn);
      }
    }
    if (randomSpawns.length > 0) random.push(subjectOf(pill, randomSpawns));
    if (startSpawns.length > 0) atStart.push(subjectOf(pill, startSpawns));
  }

  return {
    timed: [...timed]
      .sort(([a], [b]) => a - b)
      .map(([seconds, subjects]) => ({
        seconds,
        pastRaid: isPastRaid(seconds, raidMinutes),
        subjects,
      })),
    random,
    triggered: [...triggered]
      .map(([switchName, subjects]) => ({ switchName, subjects }))
      .sort((a, b) => Number(a.switchName === null) - Number(b.switchName === null)),
    atStart,
  };
}
