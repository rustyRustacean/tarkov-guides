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
  // Goons - always spawn as a unit. tarkov.dev returns them as three
  // separate entries ("Knight"/"Big Pipe"/"Birdeye", spelling varies).
  { label: "Goons", pattern: /^(death\s+)?knight$|^big\s*pipe$|^bird\s*eye$|^birdeye$/i },
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
 * confirmed live via a direct GraphQL query (both variant entries exist
 * with real, distinct boss lists). Maps not listed here just get a single
 * boss strip - see {@link getBossStripData}.
 */
export const MAP_VARIANT_SETS: Readonly<
  Record<
    string,
    {
      primary: { label: string; icon: string };
      variant: { id: string; label: string; icon: string };
    }
  >
> = {
  factory: {
    primary: { label: "Day", icon: "☀" },
    variant: { id: "night-factory", label: "Night", icon: "☾" },
  },
  "ground-zero": {
    primary: { label: "Normal", icon: "•" },
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

export interface BossPill {
  name: string;
  /** 0..1 fraction. Always the group's single highest member's chance, per legacy's explicit "no lo-hi range" spec - not modeled as a range at all here (an earlier draft's `lo`/`hi` pair was always equal by construction, so it's simplified to one field). */
  chance: number;
  /** How many real boss entries collapsed into this one pill (1 for a solo boss). */
  count: number;
  tone: BossPillTone;
  /** Face-portrait URL for the pill's boss (the highest-chance member for a grouped pill), or `null` when none is available. */
  imagePortraitLink: string | null;
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
    // member, matching the single chance figure the pill shows.
    const topMember = matches.reduce((best, m) =>
      (m.spawnChance || 0) > (best.spawnChance || 0) ? m : best,
    );
    const chance = topMember.spawnChance || 0;
    pills.push({
      name: group.label,
      chance,
      count: matches.length,
      tone: toneFor(chance),
      imagePortraitLink: topMember.imagePortraitLink,
    });
    for (const match of matches) {
      const index = remaining.indexOf(match);
      if (index !== -1) remaining.splice(index, 1);
    }
  }

  for (const boss of remaining) {
    const chance = boss.spawnChance || 0;
    pills.push({
      name: boss.name,
      chance,
      count: 1,
      tone: toneFor(chance),
      imagePortraitLink: boss.imagePortraitLink,
    });
  }

  return pills.slice().sort((a, b) => b.chance - a.chance);
}

export interface BossStripSide {
  label: string;
  pills: readonly BossPill[];
}

export interface BossStripData {
  day: BossStripSide | null;
  night: BossStripSide | null;
}

/** True if two boss lists describe the same set (same names + same chances) - ported from `mapHeader.js`'s `bossListsEqual`. */
function bossListsEqual(a: readonly RawMapBoss[], b: readonly RawMapBoss[]): boolean {
  if (a.length !== b.length) return false;
  const byName = new Map(a.map((x) => [x.name, x.spawnChance || 0]));
  return b.every((boss) => byName.get(boss.name) === (boss.spawnChance || 0));
}

/**
 * The day/night boss-strip split for one map - ported from `mapHeader.js`'s
 * `renderBossStrip`. Two independent paths, tried in order:
 *
 * 1. The map has a real tarkov.dev variant entry (Factory/Ground Zero, via
 *    {@link MAP_VARIANT_SETS}) with a genuinely different boss list - use
 *    that variant's own data for the "night"/"variant" side.
 * 2. Otherwise, partition the map's single boss list by
 *    {@link isNightOnlyBoss} (cultists etc.) - mirrors what Factory shows
 *    for every other map that has cultists, without a separate map entry.
 *
 * A side is `null` when it has nothing to show (matches legacy's empty-
 * string-HTML behavior for an empty pill list - including a `null` day side
 * for Ground Zero's own empty regular boss list, not an empty-but-labeled
 * "Normal" panel).
 */
export function getBossStripData(normalizedName: string, maps: readonly RawMap[]): BossStripData {
  const primary = maps.find((m) => m.normalizedName === normalizedName);
  const primaryBosses = primary?.bosses ?? [];
  const variantSet = MAP_VARIANT_SETS[normalizedName];
  const variantMap = variantSet
    ? maps.find((m) => m.normalizedName === variantSet.variant.id)
    : undefined;
  const variantBosses = variantMap?.bosses ?? [];

  if (variantSet && variantBosses.length > 0 && !bossListsEqual(primaryBosses, variantBosses)) {
    return {
      day: primaryBosses.length
        ? {
            label: `${variantSet.primary.icon} ${variantSet.primary.label}`,
            pills: bossPillsFor(primaryBosses),
          }
        : null,
      night: {
        label: `${variantSet.variant.icon} ${variantSet.variant.label}`,
        pills: bossPillsFor(variantBosses),
      },
    };
  }

  const dayBosses = primaryBosses.filter((b) => !isNightOnlyBoss(b.name));
  const nightBosses = primaryBosses.filter((b) => isNightOnlyBoss(b.name));

  if (dayBosses.length && nightBosses.length) {
    return {
      day: { label: "☀ Day", pills: bossPillsFor(dayBosses) },
      night: { label: "☾ Night", pills: bossPillsFor(nightBosses) },
    };
  }
  if (nightBosses.length) {
    return { day: null, night: { label: "☾ Night", pills: bossPillsFor(nightBosses) } };
  }
  if (dayBosses.length) {
    return { day: { label: "Bosses", pills: bossPillsFor(dayBosses) }, night: null };
  }
  return { day: null, night: null };
}
