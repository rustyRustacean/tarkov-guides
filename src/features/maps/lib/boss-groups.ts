import { GOON_FOLLOWER_MOB_IDS } from "@/shared/lib/tarkov-api/mob-loadouts";

import { PARTISAN_PILL_HINT, partisanKarmaApplies } from "./partisan";

import type { ProfileMode } from "@/features/progress-tracker/types";
import type {
  RawBossSpawnTiming,
  RawBossSpawnTrigger,
  RawGroundPoint,
  RawMap,
  RawMapBoss,
  RawMapBossEscort,
  RawSquadSizeChance,
} from "@/shared/lib/tarkov-api/types";

/**
 * A map entry's boss roster for a game mode: PvE and Seasonal each have
 * their own (PvE adds AI PMCs; Seasonal adds Black Division to several maps
 * and swaps Labs' Raiders for it). Falls back to the regular roster when
 * that mode's list is missing (its fetch failed, or an older payload).
 */
export function bossesForMode(map: RawMap, mode: ProfileMode): readonly RawMapBoss[] {
  if (mode === "PVE") return map.bossesPve ?? map.bosses;
  if (mode === "PVP_SEASONAL") return map.bossesSeason ?? map.bosses;
  return map.bosses;
}

/** Partisan's mob id: his card explains how karma drives his spawn chance (see `partisan.ts`). */
export const PARTISAN_MOB_ID = "bossPartisan";

/**
 * Event-only mobs: the zombies of the Halloween infection event. They get
 * the {@link EVENT_BADGE} corner glyph, like night-only bosses get the moon.
 */
const EVENT_MOB_IDS: ReadonlySet<string> = new Set([
  "infectedScreamer",
  "infectedAssault",
  "infectedPmc",
  "infectedTagilla",
]);

/**
 * Display names for mobs tarkov.dev ships with no English name (the raw code
 * comes through instead). `infectedScreamer` is one of the event zombies;
 * tarkov.dev names its siblings `infectedAssault`/`infectedPmc` plain
 * "Infected", so it matches them.
 */
const DISPLAY_NAMES: Readonly<Record<string, string>> = {
  infectedScreamer: "Infected",
};

/** Corner glyph for {@link EVENT_MOB_IDS}. */
const EVENT_BADGE: BossBadge = { icon: "🎃", title: "Halloween event" };

function isEventBoss(boss: RawMapBoss): boolean {
  return EVENT_MOB_IDS.has(boss.mobId);
}

/** `bosses` with any {@link DISPLAY_NAMES} fix applied, so grouping and pills see readable names. */
function withDisplayNames(bosses: readonly RawMapBoss[]): readonly RawMapBoss[] {
  return bosses.map((boss) => {
    const name = DISPLAY_NAMES[boss.mobId];
    return name !== undefined && boss.name === boss.mobId ? { ...boss, name } : boss;
  });
}

/**
 * Ground Zero runs as two queues with their own map entries and spawn
 * rates: `ground-zero` for levels up to 20, `ground-zero-21` from 21. The
 * strip shows one at a time, picked by a toggle (see `MapBossStrips`).
 */
export const GROUND_ZERO_QUEUES = {
  low: { entry: "ground-zero", label: "Lvl ≤20" },
  high: { entry: "ground-zero-21", label: "Lvl 21+" },
} as const;

export type GroundZeroQueue = keyof typeof GROUND_ZERO_QUEUES;

/** The queue a player of `level` lands in (21 and up goes to the high queue). */
export function groundZeroQueueFor(level: number | undefined): GroundZeroQueue {
  return level !== undefined && level >= 21 ? "high" : "low";
}

/**
 * Any boss whose name matches a group's `pattern` collapses into one pill
 * for that group (e.g. "Rogue"/"Rogue Leader"/"Rogue Ghillie" all become one
 * "Rogues" pill), ported from `old/TarkovTrackerWB-main/src/components/
 * maps/mapHeader.js`'s `ENEMY_GROUPS`. Order matters: more specific patterns
 * come first so they win over generic fallbacks (e.g. "Terminal Guards"
 * must beat the catch-all `/guard/` pattern). Legacy's per-entry `single`
 * flag and `names` Set matcher are both dropped here: neither is ever read
 * by the matching logic (`single` is set on some entries but never checked;
 * `names` is checked but never populated), so they're dead fields, not real
 * behavior to preserve.
 */
export const ENEMY_GROUPS: readonly { label: string; pattern: RegExp }[] = [
  // NOTE: the Goons are deliberately NOT grouped here. The JSON API lists
  // only their leader (Knight) on the maps they patrol, and Knight also
  // spawns as a standalone boss on Ice Breaker, so they're shown as
  // individual members (Knight + Big Pipe + Birdeye, the latter two added in
  // `getBossStripData` for the roaming maps only). See `GOON_SQUAD_MAPS`.
  //
  // Terminal Guards: the squad patrolling the Terminal map.
  { label: "Terminal Guards", pattern: /terminal\s*guard|airport\s*guard/i },
  // Black Division: returned per-soldier ("Black Div." abbreviated form
  // included, often 20+ entries on Terminal).
  { label: "Black Division", pattern: /black\s*(div\.?|division)/i },
  // AF: the other Terminal/Shoreline military faction, returned per-soldier
  // as just "AF" with no variation. Anchored so it doesn't eat other names
  // that merely contain "AF" as a substring.
  { label: "AF", pattern: /^af$/i },
  { label: "Rogues", pattern: /rogue/i },
  { label: "Raiders", pattern: /raider/i },
  { label: "Cultists", pattern: /cultist/i },
  { label: "Scavs", pattern: /boss scav|scav boss|scav\s+guard|wild\s+scav|marauder/i },
  { label: "Guards", pattern: /guard|follower|escort/i },
];

/**
 * Maps where tarkov.dev ships a time-restricted variant as a genuinely
 * separate map entry (Factory → `night-factory` for cultist spawns). The
 * variant's own bosses are merged into the map's single strip and badged
 * with `variant.icon`/`variant.label`; maps not listed here just show their
 * plain roster. See {@link getBossStripData}. Ground Zero's level-21+ entry
 * used to be merged the same way, but its shared bosses spawn at different
 * rates per queue, so it's a toggle now (see {@link GROUND_ZERO_QUEUES}).
 */
export const MAP_VARIANT_SETS: Readonly<
  Record<string, { variant: { id: string; label: string; icon: string } }>
> = {
  factory: {
    variant: { id: "night-factory", label: "Night", icon: "☾" },
  },
};

/**
 * Every map entry that is really another entry's physical map (a time
 * variant from {@link MAP_VARIANT_SETS}, or Ground Zero's level-21+ queue),
 * keyed variant id to base map id, for anything that should treat them as one
 * place (e.g. the Progress Tracker's map recommendations).
 */
export const VARIANT_TO_BASE_MAP: ReadonlyMap<string, string> = new Map([
  ...Object.entries(MAP_VARIANT_SETS).map(
    ([baseMapName, { variant }]) => [variant.id, baseMapName] as const,
  ),
  [GROUND_ZERO_QUEUES.high.entry, GROUND_ZERO_QUEUES.low.entry],
]);

/**
 * Bosses that only spawn at night, for maps with no distinct night-* map
 * entry (tarkov.dev lists cultists alongside the regular roster on a single
 * map entry for most maps, unlike Factory's separate `night-factory`), so
 * they're partitioned out client-side instead. Also catches any future boss
 * whose name explicitly includes "Night".
 */
const NIGHT_ENEMY_PATTERNS: readonly RegExp[] = [/cultist/i, /^night\b/i, /\bnight\b/i];

/** Whether `name` matches a night-only pattern (cultists etc.); see {@link NIGHT_ENEMY_PATTERNS}. */
export function isNightOnlyBoss(name: string): boolean {
  return NIGHT_ENEMY_PATTERNS.some((pattern) => pattern.test(name));
}

export type BossPillTone = "hot" | "warm" | "cool" | "mute";

/** The threat tone for a 0..1 chance: `hi`-only thresholds ported verbatim from `mapHeader.js`'s `tone()`. */
export function toneFor(chance: number): BossPillTone {
  if (chance >= 0.5) return "hot";
  if (chance >= 0.25) return "warm";
  if (chance >= 0.1) return "cool";
  return "mute";
}

/**
 * A small corner glyph on a pill marking a boss that only appears under a
 * special condition: a moon for night-only spawns (cultists etc.), or a
 * level-gate glyph for a map's restricted variant (Ground Zero's Lvl 21+).
 * Replaces the old separate Day/Night strip labels: one merged strip, with
 * the condition shown per-boss instead.
 */
export interface BossBadge {
  /** Glyph overlaid on the portrait (e.g. "☾" for night, "★" for a level gate). */
  icon: string;
  /** Reason, surfaced in the pill's hover title (e.g. "night only"). */
  title: string;
}

export interface BossPill {
  name: string;
  /** 0..1 fraction: always the group's single highest member's chance, per legacy's explicit "no lo-hi range" spec. Not modeled as a range here. */
  chance: number;
  tone: BossPillTone;
  /** Face-portrait URL for the pill's boss (the highest-chance member for a grouped pill), or `null` when none is available. */
  imagePortraitLink: string | null;
  /** Every distinct mob id behind this pill, highest-chance member first: one for a named boss, several for a faction group (e.g. Black Division's three soldier types). Keys into the game data's `mobs` for the gear and loot card. */
  mobIds: readonly string[];
  /** Guard types that spawn with this pill's boss on this map, in upstream's order; empty for a boss that spawns alone. Never the pill's own mobs (see `groupSize`) or the Goons (see {@link NOT_GUARDS}). */
  guards: readonly BossGuard[];
  /** For a faction pill whose members escort their own kind (Raiders, Rogues, Black Division): how many spawn together, the leader included. `null` when there are no such spawns. */
  groupSize: readonly RawSquadSizeChance[] | null;
  /** Present only for a conditional spawn (night, or a level-gated variant); drives the corner glyph. Absent for a regular always-present boss. */
  badge?: BossBadge;
  /** Extra hover-text qualifier for the spawn chance (Partisan's karma dependence in PvP and Seasonal). */
  note?: string;
  /** Each upstream spawn entry behind this pill, in upstream's order (Raiders on Labs have 16): where and when it can happen. Feeds the card's "Where and when" and the map's Spawn timeline (see `boss-spawns.ts`). */
  spawns: readonly BossSpawn[];
}

/** One spawn zone of a {@link BossSpawn}, with its possible spots on the map. */
export interface BossSpawnZone {
  /** Upstream's zone key, the key into the map's `bossSpawnSpots`. */
  key: string;
  name: string;
  /** 0..1 chance of this zone, given that the spawn happens. */
  chance: number;
  /** Possible spawn spots in game space; empty when upstream lists none for this zone. */
  spots: readonly RawGroundPoint[];
}

/** One upstream spawn entry behind a pill. */
export interface BossSpawn {
  /** 0..1 chance this spawn happens at all. */
  chance: number;
  /** Empty for a boss with no fixed zones (Partisan) or no zone data. */
  zones: readonly BossSpawnZone[];
  /** `null` when upstream ships no time. */
  timing: RawBossSpawnTiming | null;
  /** `null` unless using a switch triggers this spawn. */
  trigger: RawBossSpawnTrigger | null;
  /** For a faction pill whose members travel together: how many spawn, the leader included. `null` otherwise. */
  groupSize: readonly RawSquadSizeChance[] | null;
}

/** A map entry's possible boss spawn spots per zone key (`RawMap.bossSpawnSpots`). */
type SpawnSpots = Readonly<Record<string, readonly RawGroundPoint[]>>;

const NO_SPOTS: SpawnSpots = {};

/** A guard type that spawns with a pill's boss. */
export interface BossGuard {
  mobId: string;
  name: string;
  imagePortraitLink: string | null;
  /** How many come along per spawn, as a distribution, ascending by count. */
  amounts: readonly RawSquadSizeChance[];
}

/**
 * Escorts never shown as guards. The Goons are three bosses roaming
 * together, not Knight and two guards: Big Pipe and Birdeye get pills of
 * their own (see {@link withGoonSquad}), even though upstream lists them as
 * Knight's escorts.
 */
const NOT_GUARDS: ReadonlySet<string> = new Set(Object.values(GOON_FOLLOWER_MOB_IDS));

/** "Nobody else": the starting point when adding squad sizes up. */
const NONE: readonly RawSquadSizeChance[] = [{ count: 0, chance: 1 }];

/** The faction leader itself, added to its own kind's escort count to get a group size. */
const LEADER: readonly RawSquadSizeChance[] = [{ count: 1, chance: 1 }];

/** The distribution of the sum of two independent squad sizes (one mob listed twice on one spawn), ascending by count. */
function addSquadSizes(
  a: readonly RawSquadSizeChance[],
  b: readonly RawSquadSizeChance[],
): readonly RawSquadSizeChance[] {
  const byCount = new Map<number, number>();
  for (const x of a) {
    for (const y of b) {
      const count = x.count + y.count;
      byCount.set(count, (byCount.get(count) ?? 0) + x.chance * y.chance);
    }
  }
  return [...byCount.entries()]
    .map(([count, chance]) => ({ count, chance }))
    .sort((x, y) => x.count - y.count);
}

/**
 * Several spawn entries' squad sizes as one distribution, each entry
 * weighted equally (upstream lists a boss once per possible spawn, e.g.
 * Raiders 16 times on Labs, so this is "across this map's spawns"), ascending
 * by count.
 */
function averageSquadSizes(
  perSpawn: readonly (readonly RawSquadSizeChance[])[],
): readonly RawSquadSizeChance[] {
  const byCount = new Map<number, number>();
  for (const amounts of perSpawn) {
    for (const { count, chance } of amounts) {
      byCount.set(count, (byCount.get(count) ?? 0) + chance / perSpawn.length);
    }
  }
  return [...byCount.entries()]
    .map(([count, chance]) => ({ count, chance }))
    .sort((x, y) => x.count - y.count);
}

/**
 * Splits the escorts of every spawn entry behind one pill into its guards
 * and, for a faction, its group size. Within one spawn, the same mob listed
 * several times adds up (Black Division on Terminal lists its own soldier
 * twice). An escort of the pill's own mobs is the group traveling together
 * rather than a guard: for a faction pill that becomes `groupSize`, and for
 * a named boss it's dropped (The Wedge on Ice Breaker lists itself, which
 * says nothing useful about a single unique boss). Guards are averaged over
 * the spawns that bring them, the group size over the spawns that travel in
 * a group.
 */
function escortsFor(
  members: readonly RawMapBoss[],
  ownMobIds: readonly string[],
  isFaction: boolean,
): Pick<BossPill, "guards" | "groupSize"> {
  const own = new Set(ownMobIds);
  const guards = new Map<
    string,
    { escort: RawMapBossEscort; perSpawn: (readonly RawSquadSizeChance[])[] }
  >();
  const groupSizes: (readonly RawSquadSizeChance[])[] = [];

  for (const member of members) {
    const byMob = new Map<
      string,
      { escort: RawMapBossEscort; amounts: readonly RawSquadSizeChance[] }
    >();
    for (const escort of member.escorts) {
      if (escort.amounts.length === 0 || NOT_GUARDS.has(escort.mobId)) continue;
      const previous = byMob.get(escort.mobId);
      byMob.set(escort.mobId, {
        escort: previous?.escort ?? escort,
        amounts: addSquadSizes(previous?.amounts ?? NONE, escort.amounts),
      });
    }

    let ownKind: readonly RawSquadSizeChance[] | null = null;
    for (const [mobId, { escort, amounts }] of byMob) {
      if (own.has(mobId)) {
        ownKind = addSquadSizes(ownKind ?? NONE, amounts);
        continue;
      }
      const guard = guards.get(mobId) ?? { escort, perSpawn: [] };
      guard.perSpawn.push(amounts);
      guards.set(mobId, guard);
    }
    if (ownKind && isFaction) groupSizes.push(addSquadSizes(ownKind, LEADER));
  }

  return {
    guards: [...guards.values()].map(({ escort, perSpawn }) => ({
      mobId: escort.mobId,
      name: escort.name,
      imagePortraitLink: escort.imagePortraitLink,
      amounts: averageSquadSizes(perSpawn),
    })),
    groupSize: groupSizes.length > 0 ? averageSquadSizes(groupSizes) : null,
  };
}

/** Distinct mob ids of `members`, with `top`'s first so a single-member lookup lands on the pill's own face. */
function mobIdsFor(top: RawMapBoss, members: readonly RawMapBoss[]): readonly string[] {
  return [...new Set([top.mobId, ...members.map((member) => member.mobId)])];
}

/** Each member's own spawn, its zones resolved to their spots in `spots`. A faction member's group size comes from its own escorts, like the pill's (see {@link escortsFor}). */
function spawnsFor(
  members: readonly RawMapBoss[],
  ownMobIds: readonly string[],
  isFaction: boolean,
  spots: SpawnSpots,
): readonly BossSpawn[] {
  return members.map((member) => ({
    chance: member.spawnChance,
    zones: (member.spawnZones ?? []).map((zone) => ({ ...zone, spots: spots[zone.key] ?? [] })),
    timing: member.spawnTiming ?? null,
    trigger: member.spawnTrigger ?? null,
    groupSize: isFaction ? escortsFor([member], ownMobIds, true).groupSize : null,
  }));
}

/**
 * Groups a map's boss list into display pills, ported from `mapHeader.js`'s
 * `buildBossStripHtml`. Sorted scariest-first (highest chance first) so the
 * most threatening pill reads first. `spots` is the map entry's
 * `bossSpawnSpots`, which each pill's spawn zones are resolved against.
 */
export function bossPillsFor(
  bosses: readonly RawMapBoss[],
  spots: SpawnSpots = NO_SPOTS,
): readonly BossPill[] {
  const remaining = bosses.slice();
  const pills: BossPill[] = [];

  for (const group of ENEMY_GROUPS) {
    const matches = remaining.filter((boss) => group.pattern.test(boss.name));
    if (matches.length === 0) continue;
    // The grouped pill wears the face of its scariest (highest-chance)
    // member, matching the single chance figure the pill shows. The strip
    // shows only that the faction is present, never how many bots there are.
    const topMember = matches.reduce((best, m) =>
      (m.spawnChance || 0) > (best.spawnChance || 0) ? m : best,
    );
    const chance = topMember.spawnChance || 0;
    const mobIds = mobIdsFor(topMember, matches);
    pills.push({
      name: group.label,
      chance,
      tone: toneFor(chance),
      imagePortraitLink: topMember.imagePortraitLink,
      mobIds,
      ...escortsFor(matches, mobIds, true),
      spawns: spawnsFor(matches, mobIds, true, spots),
    });
    for (const match of matches) {
      const index = remaining.indexOf(match);
      if (index !== -1) remaining.splice(index, 1);
    }
  }

  // Collapse whatever's left by identical display name. These are unique
  // named bosses (a faction of many bots would have matched an ENEMY_GROUP
  // above), so the API listing one N times just means N possible spawn points
  // for the same single boss (e.g. "The Wedge" x12 on Ice Breaker). Show it
  // once, presence only.
  const byName = new Map<string, RawMapBoss[]>();
  for (const boss of remaining) {
    const group = byName.get(boss.name) ?? [];
    group.push(boss);
    byName.set(boss.name, group);
  }
  for (const [name, group] of byName) {
    const topMember = group.reduce((best, m) =>
      (m.spawnChance || 0) > (best.spawnChance || 0) ? m : best,
    );
    const chance = topMember.spawnChance || 0;
    const mobIds = mobIdsFor(topMember, group);
    pills.push({
      name,
      chance,
      tone: toneFor(chance),
      imagePortraitLink: topMember.imagePortraitLink,
      mobIds,
      ...escortsFor(group, mobIds, false),
      spawns: spawnsFor(group, mobIds, false, spots),
    });
  }

  return pills.slice().sort((a, b) => b.chance - a.chance);
}

export interface BossStripData {
  /** All of a map's bosses in one merged strip (no Day/Night split). Regular bosses first, then conditional ones (night / level-gated), which carry a {@link BossBadge}. Empty when the map has no bosses. */
  pills: readonly BossPill[];
}

/** Returns a copy of `pills` with `badge` stamped on each; marks a conditional (night / level-gated) subset. */
function withBadge(pills: readonly BossPill[], badge: BossBadge): readonly BossPill[] {
  return pills.map((pill) => ({ ...pill, badge }));
}

/** True if two boss lists describe the same set (same names + same chances); ported from `mapHeader.js`'s `bossListsEqual`. */
function bossListsEqual(a: readonly RawMapBoss[], b: readonly RawMapBoss[]): boolean {
  if (a.length !== b.length) return false;
  const byName = new Map(a.map((x) => [x.name, x.spawnChance || 0]));
  return b.every((boss) => byName.get(boss.name) === (boss.spawnChance || 0));
}

/** Moon badge for night-only bosses (cultists etc.) partitioned out of a map's single roster. */
const NIGHT_BADGE: BossBadge = { icon: "☾", title: "night only" };

/**
 * Maps the Goons patrol as a roaming trio. The JSON API lists only their
 * leader (Knight) on these, so Big Pipe and Birdeye are added in
 * {@link withGoonSquad}. Ice Breaker is deliberately absent: its Knight is a
 * standalone map boss, not the roaming squad, so it shows alone.
 */
const GOON_SQUAD_MAPS: ReadonlySet<string> = new Set([
  "customs",
  "woods",
  "lighthouse",
  "shoreline",
]);

/**
 * Knight's two squadmates. They have no boss entry of their own on the maps
 * the Goons roam, so they're added here at Knight's spawn chance, zones and
 * timing (the three roam together). Portraits
 * are the same `assets.tarkov.dev` faces the API serves for every other boss
 * (Knight's own portrait comes straight from the API).
 */
const GOON_FOLLOWERS: readonly { mobId: string; name: string; imagePortraitLink: string }[] = [
  {
    mobId: GOON_FOLLOWER_MOB_IDS.bigPipe,
    name: "Big Pipe",
    imagePortraitLink: "https://assets.tarkov.dev/big-pipe-portrait.png",
  },
  {
    mobId: GOON_FOLLOWER_MOB_IDS.birdeye,
    name: "Birdeye",
    imagePortraitLink: "https://assets.tarkov.dev/birdeye-portrait.png",
  },
];

/**
 * On a roaming-Goons map (see {@link GOON_SQUAD_MAPS}) where Knight is
 * present, appends Big Pipe and Birdeye so the whole squad shows. A no-op on
 * every other map (including Ice Breaker, whose lone Knight stays lone).
 */
function withGoonSquad(
  normalizedName: string,
  bosses: readonly RawMapBoss[],
): readonly RawMapBoss[] {
  if (!GOON_SQUAD_MAPS.has(normalizedName)) return bosses;
  const knight = bosses.find((boss) => boss.name === "Knight");
  if (!knight) return bosses;
  const additions = GOON_FOLLOWERS.filter(
    (follower) => !bosses.some((boss) => boss.name === follower.name),
  ).map((follower): RawMapBoss => ({
    mobId: follower.mobId,
    name: follower.name,
    normalizedName: follower.name.toLowerCase().replace(/\s+/g, "-"),
    imagePortraitLink: follower.imagePortraitLink,
    spawnChance: knight.spawnChance,
    escorts: [],
    ...(knight.spawnZones ? { spawnZones: knight.spawnZones } : {}),
    ...(knight.spawnTiming ? { spawnTiming: knight.spawnTiming } : {}),
    ...(knight.spawnTrigger ? { spawnTrigger: knight.spawnTrigger } : {}),
  }));
  return additions.length > 0 ? [...bosses, ...additions] : bosses;
}

/**
 * One map's bosses as a single merged strip, ported in spirit from
 * `mapHeader.js`'s `renderBossStrip`, but without the old Day/Night split
 * into two labeled sides. Regular (always-present) bosses come first, then
 * conditional ones, which carry a {@link BossBadge} corner glyph instead of a
 * separate labeled side. Two sources of conditional bosses, deduped by name
 * against the regular roster so nothing shows twice:
 *
 * 1. A real tarkov.dev variant entry (Factory's `night-factory`, via
 *    {@link MAP_VARIANT_SETS}): its variant-exclusive bosses get that
 *    variant's own icon (Factory ☾ night).
 * 2. Otherwise, bosses matching {@link isNightOnlyBoss} (cultists etc.) get
 *    the moon badge, mirroring what Factory shows for every other map that
 *    has cultists, without a separate map entry.
 *
 * Halloween event mobs ({@link EVENT_MOB_IDS}) always come last with the
 * {@link EVENT_BADGE}.
 *
 * Reads the roster for `mode` (see {@link bossesForMode}). `rosterEntry`
 * picks a different map entry to read than `normalizedName` itself, for
 * Ground Zero's level-21+ queue ({@link GROUND_ZERO_QUEUES}). Each pill's
 * spawn zones resolve against the spawn spots of the entry its bosses came
 * from (a variant's own entry for its exclusive bosses).
 *
 * `pills` is empty when the map has no bosses (or isn't found).
 */
export function getBossStripData(
  normalizedName: string,
  maps: readonly RawMap[],
  { mode = "PVP", rosterEntry = normalizedName }: { mode?: ProfileMode; rosterEntry?: string } = {},
): BossStripData {
  const entryFor = (entry: string): RawMap | undefined =>
    maps.find((m) => m.normalizedName === entry);
  const rosterOf = (map: RawMap | undefined): readonly RawMapBoss[] =>
    withDisplayNames(map ? bossesForMode(map, mode) : []);
  const rosterMap = entryFor(rosterEntry);
  const spots = rosterMap?.bossSpawnSpots ?? NO_SPOTS;
  const all = withGoonSquad(normalizedName, rosterOf(rosterMap));
  const eventPills = withBadge(bossPillsFor(all.filter(isEventBoss), spots), EVENT_BADGE);
  const primaryBosses = all.filter((boss) => !isEventBoss(boss));

  const variantSet = MAP_VARIANT_SETS[normalizedName];
  const variantMap = variantSet ? entryFor(variantSet.variant.id) : undefined;
  const variantBosses = variantSet ? rosterOf(variantMap).filter((boss) => !isEventBoss(boss)) : [];

  const finish = (pills: readonly BossPill[]): BossStripData => ({
    pills: partisanKarmaApplies(mode)
      ? pills.map((pill) =>
          pill.mobIds.includes(PARTISAN_MOB_ID) ? { ...pill, note: PARTISAN_PILL_HINT } : pill,
        )
      : pills,
  });

  if (variantSet && variantBosses.length > 0 && !bossListsEqual(primaryBosses, variantBosses)) {
    // Only the variant's own additions get badged; a boss present in both
    // rosters (e.g. Factory's Tagilla) stays a single regular pill.
    const primaryNames = new Set(primaryBosses.map((b) => b.name));
    const exclusive = variantBosses.filter((b) => !primaryNames.has(b.name));
    const badge: BossBadge = { icon: variantSet.variant.icon, title: variantSet.variant.label };
    return finish([
      ...bossPillsFor(primaryBosses, spots),
      ...withBadge(bossPillsFor(exclusive, variantMap?.bossSpawnSpots ?? NO_SPOTS), badge),
      ...eventPills,
    ]);
  }

  const dayBosses = primaryBosses.filter((b) => !isNightOnlyBoss(b.name));
  const nightBosses = primaryBosses.filter((b) => isNightOnlyBoss(b.name));
  return finish([
    ...bossPillsFor(dayBosses, spots),
    ...withBadge(bossPillsFor(nightBosses, spots), NIGHT_BADGE),
    ...eventPills,
  ]);
}
