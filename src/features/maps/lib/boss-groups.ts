import type { RawMap, RawMapBoss } from "@/shared/lib/tarkov-api/types";

/**
 * Any boss whose name matches a group's `pattern` collapses into one pill
 * for that group (e.g. "Rogue"/"Rogue Leader"/"Rogue Ghillie" all become one
 * "Rogues" pill) - ported from `old/TarkovTrackerWB-main/src/components/
 * maps/mapHeader.js`'s `ENEMY_GROUPS`. Order matters: more specific patterns
 * come first so they win over generic fallbacks (e.g. "Terminal Guards"
 * must beat the catch-all `/guard/` pattern). Legacy's per-entry `single`
 * flag and `names` Set matcher are both dropped here - confirmed via direct
 * inspection that neither is ever read by the matching logic (`single` is
 * set on some entries but never checked; `names` is checked but never
 * populated by any entry) - dead fields, not real behavior to preserve.
 */
export const ENEMY_GROUPS: readonly { label: string; pattern: RegExp }[] = [
  // NOTE: the Goons are deliberately NOT grouped here. The JSON API lists
  // only their leader (Knight) on the maps they patrol, and Knight also
  // spawns as a standalone boss on Ice Breaker - so they're shown as
  // individual members (Knight + Big Pipe + Birdeye, the latter two added in
  // `getBossStripData` for the roaming maps only). See `GOON_SQUAD_MAPS`.
  //
  // Terminal Guards - the squad patrolling the Terminal map.
  { label: "Terminal Guards", pattern: /terminal\s*guard|airport\s*guard/i },
  // Black Division - returned per-soldier ("Black Div." abbreviated form
  // included, often 20+ entries on Terminal).
  { label: "Black Division", pattern: /black\s*(div\.?|division)/i },
  // AF - the other Terminal/Shoreline military faction, returned per-soldier
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
 * Maps where tarkov.dev ships a time-/level-restricted variant as a
 * genuinely separate map entry (Factory → `night-factory` for cultist
 * spawns, Ground Zero → `ground-zero-21` for the level-21+ gated variant) -
 * confirmed live via a direct query (both variant entries exist with real,
 * distinct boss lists). The variant's own bosses are merged into the map's
 * single strip and badged with `variant.icon`/`variant.label`; maps not
 * listed here just show their plain roster - see {@link getBossStripData}.
 */
export const MAP_VARIANT_SETS: Readonly<
  Record<string, { variant: { id: string; label: string; icon: string } }>
> = {
  factory: {
    variant: { id: "night-factory", label: "Night", icon: "☾" },
  },
  "ground-zero": {
    variant: { id: "ground-zero-21", label: "Lvl 21+", icon: "★" },
  },
};

/**
 * Bosses that only spawn at night, for maps with no distinct night-* map
 * entry (tarkov.dev lists cultists alongside the regular roster on a single
 * map entry for most maps, unlike Factory's separate `night-factory`) - so
 * they're partitioned out client-side instead. Also catches any future boss
 * whose name explicitly includes "Night".
 */
const NIGHT_ENEMY_PATTERNS: readonly RegExp[] = [/cultist/i, /^night\b/i, /\bnight\b/i];

/** Whether `name` matches a night-only pattern (cultists etc.) - see {@link NIGHT_ENEMY_PATTERNS}. */
export function isNightOnlyBoss(name: string): boolean {
  return NIGHT_ENEMY_PATTERNS.some((pattern) => pattern.test(name));
}

export type BossPillTone = "hot" | "warm" | "cool" | "mute";

/** `hi`-only chance thresholds ported verbatim from `mapHeader.js`'s `tone()`. */
function toneFor(chance: number): BossPillTone {
  if (chance >= 0.5) return "hot";
  if (chance >= 0.25) return "warm";
  if (chance >= 0.1) return "cool";
  return "mute";
}

/**
 * A small corner glyph on a pill marking a boss that only appears under a
 * special condition - a moon for night-only spawns (cultists etc.), or a
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
  /** 0..1 fraction. Always the group's single highest member's chance, per legacy's explicit "no lo-hi range" spec - not modeled as a range at all here (an earlier draft's `lo`/`hi` pair was always equal by construction, so it's simplified to one field). */
  chance: number;
  tone: BossPillTone;
  /** Face-portrait URL for the pill's boss (the highest-chance member for a grouped pill), or `null` when none is available. */
  imagePortraitLink: string | null;
  /** Present only for a conditional spawn (night, or a level-gated variant) - drives the corner glyph. Absent for a regular always-present boss. */
  badge?: BossBadge;
}

/**
 * Groups a map's boss list into display pills - ported from `mapHeader.js`'s
 * `buildBossStripHtml`. Sorted scariest-first (highest chance first) so the
 * most threatening pill reads first.
 */
export function bossPillsFor(bosses: readonly RawMapBoss[]): readonly BossPill[] {
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
    pills.push({
      name: group.label,
      chance,
      tone: toneFor(chance),
      imagePortraitLink: topMember.imagePortraitLink,
    });
    for (const match of matches) {
      const index = remaining.indexOf(match);
      if (index !== -1) remaining.splice(index, 1);
    }
  }

  // Collapse whatever's left by identical display name. These are unique
  // named bosses (a faction of many bots would have matched an ENEMY_GROUP
  // above), so the API listing one N times just means N possible spawn points
  // for the same single boss (e.g. "The Wedge" x12 on Ice Breaker) - show it
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
    pills.push({
      name,
      chance,
      tone: toneFor(chance),
      imagePortraitLink: topMember.imagePortraitLink,
    });
  }

  return pills.slice().sort((a, b) => b.chance - a.chance);
}

export interface BossStripData {
  /** All of a map's bosses in one merged strip (no Day/Night split). Regular bosses first, then conditional ones (night / level-gated), which carry a {@link BossBadge}. Empty when the map has no bosses. */
  pills: readonly BossPill[];
}

/** Returns a copy of `pills` with `badge` stamped on each - marks a conditional (night / level-gated) subset. */
function withBadge(pills: readonly BossPill[], badge: BossBadge): readonly BossPill[] {
  return pills.map((pill) => ({ ...pill, badge }));
}

/** True if two boss lists describe the same set (same names + same chances) - ported from `mapHeader.js`'s `bossListsEqual`. */
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
 * {@link withGoonSquad}. Ice Breaker is deliberately absent - its Knight is a
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
 * the Goons roam, so they're added here at Knight's spawn chance. Portraits
 * are the same `assets.tarkov.dev` faces the API serves for every other boss
 * (Knight's own portrait comes straight from the API).
 */
const GOON_FOLLOWERS: readonly { name: string; imagePortraitLink: string }[] = [
  { name: "Big Pipe", imagePortraitLink: "https://assets.tarkov.dev/big-pipe-portrait.png" },
  { name: "Birdeye", imagePortraitLink: "https://assets.tarkov.dev/birdeye-portrait.png" },
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
  ).map((follower) => ({
    name: follower.name,
    normalizedName: follower.name.toLowerCase().replace(/\s+/g, "-"),
    imagePortraitLink: follower.imagePortraitLink,
    spawnChance: knight.spawnChance,
  }));
  return additions.length > 0 ? [...bosses, ...additions] : bosses;
}

/**
 * One map's bosses as a single merged strip - ported in spirit from
 * `mapHeader.js`'s `renderBossStrip`, but without the old Day/Night split
 * into two labeled sides. Regular (always-present) bosses come first, then
 * conditional ones, which carry a {@link BossBadge} corner glyph instead of a
 * separate labeled side. Two sources of conditional bosses, deduped by name
 * against the regular roster so nothing shows twice:
 *
 * 1. A real tarkov.dev variant entry (Factory's `night-factory`, Ground
 *    Zero's `ground-zero-21`, via {@link MAP_VARIANT_SETS}) - its
 *    variant-exclusive bosses get that variant's own icon (Factory ☾ night,
 *    Ground Zero ★ Lvl 21+).
 * 2. Otherwise, bosses matching {@link isNightOnlyBoss} (cultists etc.) get
 *    the moon badge - mirrors what Factory shows for every other map that
 *    has cultists, without a separate map entry.
 *
 * `pills` is empty when the map has no bosses (or isn't found).
 */
export function getBossStripData(normalizedName: string, maps: readonly RawMap[]): BossStripData {
  const primary = maps.find((m) => m.normalizedName === normalizedName);
  const primaryBosses = withGoonSquad(normalizedName, primary?.bosses ?? []);
  const variantSet = MAP_VARIANT_SETS[normalizedName];
  const variantMap = variantSet
    ? maps.find((m) => m.normalizedName === variantSet.variant.id)
    : undefined;
  const variantBosses = variantMap?.bosses ?? [];

  if (variantSet && variantBosses.length > 0 && !bossListsEqual(primaryBosses, variantBosses)) {
    // Only the variant's own additions get badged - a boss present in both
    // rosters (e.g. Factory's Tagilla) stays a single regular pill.
    const primaryNames = new Set(primaryBosses.map((b) => b.name));
    const exclusive = variantBosses.filter((b) => !primaryNames.has(b.name));
    const badge: BossBadge = { icon: variantSet.variant.icon, title: variantSet.variant.label };
    return {
      pills: [...bossPillsFor(primaryBosses), ...withBadge(bossPillsFor(exclusive), badge)],
    };
  }

  const dayBosses = primaryBosses.filter((b) => !isNightOnlyBoss(b.name));
  const nightBosses = primaryBosses.filter((b) => isNightOnlyBoss(b.name));
  return {
    pills: [...bossPillsFor(dayBosses), ...withBadge(bossPillsFor(nightBosses), NIGHT_BADGE)],
  };
}
