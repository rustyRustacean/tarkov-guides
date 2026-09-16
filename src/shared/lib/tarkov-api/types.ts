// ─── Raw wire types ──────────────────────────────────────────────────────
// This is the shape `join-json-api-data.ts` normalizes tarkov.dev's JSON API
// into, the same shape the old, now-defunct GraphQL endpoint used to hand
// back pre-joined directly. Kept unchanged across that migration on purpose
// so every consumer downstream of `fetch-tarkov-data-upstream.ts` didn't
// need to change. Nullability is based on the original GraphQL schema's
// introspection results (see git history predating the migration) plus the
// new JSON API's own real payloads; worth re-verifying against a live fetch
// if a field ever behaves unexpectedly, rather than assumed authoritative
// from day one.

/** A minimal item reference, as embedded everywhere an item is referenced (`item: { id, name, shortName, iconLink }`), resolved from a bare id by `join-json-api-data.ts`'s `toItemRef`. */
export interface RawItemRef {
  id: string;
  name: string;
  shortName: string;
  iconLink: string | null;
}

export interface RawTaskObjectiveBase {
  id: string;
  type: string;
  description: string;
  optional: boolean;
  maps: readonly { normalizedName: string }[];
}

/**
 * One in-raid location tied to an objective (`TaskZone` in tarkov.dev's
 * schema), confirmed via live introspection: `map`/`position` are both
 * nullable, `position.{x,y,z}` are non-null when present. `y` (vertical) is
 * carried but never used for map-marker placement: markers project onto a
 * flat 2D map via `x`/`z` only (Unity world-space: x=east, z=north),
 * matching `old/TarkovTrackerWB-main/src/lib/taskMarkers.js`'s explicit
 * "we ignore vertical y" comment.
 */
export interface RawTaskZone {
  id: string;
  map: { normalizedName: string } | null;
  position: { x: number; y: number; z: number } | null;
}

/**
 * The JSON API's objectives have ~17 distinct `type`s (`findItem`/`giveItem`/
 * `mark`/`buildWeapon`/...), each carrying a different subset of these
 * fields. Modeled as all-optional fields rather than a discriminated
 * union, since there's no single shared discriminant field name across all
 * of them worth building one around. `join-json-api-data.ts`'s `joinObjective`
 * decides which optional fields to populate per `type`; normalization code
 * downstream narrows via presence checks (`if (objective.item)`), same
 * convention as before the GraphQL→JSON API migration.
 */
export type RawTaskObjective = RawTaskObjectiveBase & {
  item?: RawItemRef;
  count?: number;
  foundInRaid?: boolean;
  markerItem?: RawItemRef;
  zones?: readonly RawTaskZone[];
};

export interface RawFinishRewardItem {
  /** `basePrice` is selected here specifically (not part of the generic {@link RawItemRef} shape used elsewhere) to drive the quest priority score's "high-value reward" factor. */
  item: RawItemRef & { basePrice: number };
  count: number;
}

/** A minimal trader reference, as embedded in every reward bucket that names a trader (`traderStanding`/`traderUnlock`/`offerUnlock`), resolved from a bare id by `join-json-api-data.ts`'s `toTraderRef`. Same `{id, name, imageLink}` shape as {@link RawTask.trader}. */
export interface RawRewardTraderRef {
  id: string;
  name: string;
  imageLink: string | null;
}

export interface RawFinishRewards {
  items: readonly RawFinishRewardItem[];
  traderStanding: readonly { trader: RawRewardTraderRef; standing: number }[];
  /** Wrapped in a `trader` object (the wire API's `traderUnlock` is a bare id list) for shape consistency with `traderStanding`/`offerUnlock`: every trader-bearing bucket nests its trader fields under `.trader`, never flat. */
  traderUnlock: readonly { trader: RawRewardTraderRef }[];
  offerUnlock: readonly {
    trader: RawRewardTraderRef;
    level: number;
    item: { name: string; shortName: string; iconLink: string | null };
  }[];
  skillLevelReward: readonly { name: string; level: number }[];
}

/**
 * One trader-loyalty-style gate on a task, as tarkov.dev's `traderRequirements`
 * field models it. Confirmed via live schema introspection and real sample
 * data against `api.tarkov.dev`: `requirementType` is observed as `"level"`
 * (loyalty level) or `"reputation"` (standing/karma, e.g. Fence),
 * `compareMethod` as `">="`, `"<"`, or `"<="`. All three of
 * `requirementType`/`compareMethod`/`value` are nullable per the schema;
 * entries with any of them null can't be evaluated and are dropped during
 * normalization (see `normalize-task.ts`).
 */
export interface RawTraderRequirement {
  id: string | null;
  trader: { id: string; name: string };
  requirementType: string | null;
  compareMethod: string | null;
  value: number | null;
}

/**
 * The player's real-time wait after a prerequisite completes before this
 * task actually becomes available, confirmed via live schema introspection
 * and cross-checked against the wiki, whose infobox for "The Door"
 * literally annotates its prerequisite as `[[Signal - Part 3]] (+2hr)`,
 * matching this task's live `availableDelaySecondsMin/Max` of 7200/7700.
 * Both fields are nullable per the live schema (31/510 real tasks return
 * `null`, not `0`); `null` is treated as "no delay" during normalization,
 * same as an explicit `0`.
 */
export interface RawTask {
  id: string;
  name: string;
  kappaRequired: boolean;
  /**
   * Whether tarkov.dev's `otherRequirements` lists a `globalVariable`/
   * `dialogue` gate: an internal progression condition the API exposes as
   * present but never lets this app evaluate. Confirmed mutually exclusive
   * with having any `taskRequirements` on every real task, 2026-08-13.
   * Display-only (a "hidden requirement" badge), never factored into
   * availability, since there's nothing to check it against.
   */
  hasHiddenRequirement: boolean;
  /** Nullable per the live schema, though 0/510 real tasks were observed with a `null` value; defaulted to `0` (no level gate) during normalization rather than trusted as always-present. */
  minPlayerLevel: number | null;
  /** XP awarded on completion. */
  experience: number;
  wikiLink: string | null;
  factionName: string | null;
  taskImageLink: string | null;
  availableDelaySecondsMin: number | null;
  availableDelaySecondsMax: number | null;
  /** Whether the task can be failed and retried. Nullable per the live schema; never observed `null` in practice (0/510). */
  restartable: boolean | null;
  /** Whether this task counts toward unlocking access to the Lightkeeper trader: an informational flag, not itself a startable-gate. */
  lightkeeperRequired: boolean | null;
  /**
   * The minimum Prestige tier the player must already have to start this
   * task, confirmed via wiki cross-reference that tarkov.dev's
   * `prestigeLevel: N` means "must have Prestige level N", matching the
   * wiki's own "Must have Prestige level N" requirement text exactly
   * (checked across all 4 real "New Beginning" tasks). `null` means no
   * Prestige requirement (either genuinely ungated, or gated at Prestige 0;
   * the wiki's "must have no Prestige" case also normalizes to a `null`
   * `requiredPrestige` on the live API).
   */
  requiredPrestige: { prestigeLevel: number } | null;
  trader: { id: string; name: string; imageLink: string | null };
  map: { name: string; normalizedName: string } | null;
  taskRequirements: readonly { task: { id: string }; status: readonly string[] }[];
  traderRequirements: readonly RawTraderRequirement[];
  objectives: readonly RawTaskObjective[];
  /** Same `TaskObjective` interface/fragment shape as {@link RawTask.objectives}: the conditions that fail this task rather than complete it (e.g. a timer, an alternate branch being taken). */
  failConditions: readonly RawTaskObjective[];
  startRewards: RawFinishRewards | null;
  finishRewards: RawFinishRewards | null;
  /** Rewards granted on a failed (non-restartable) outcome, e.g. a consolation item. */
  failureOutcome: RawFinishRewards | null;
}

export interface RawHideoutItemRequirement {
  item: RawItemRef;
  count: number;
}
export interface RawHideoutLevel {
  level: number;
  itemRequirements: readonly RawHideoutItemRequirement[];
  stationLevelRequirements: readonly { station: { normalizedName: string }; level: number }[];
}
export interface RawHideoutStation {
  id: string;
  name: string;
  normalizedName: string;
  levels: readonly RawHideoutLevel[];
}

export interface RawSellForEntry {
  priceRUB: number;
  vendor: { name: string; normalizedName: string };
}
export interface RawBuyForVendor {
  name: string;
  normalizedName: string;
  // Always populated by `join-json-api-data.ts` today: the JSON API's
  // `buyFromTrader` (unlike the old GraphQL `buyFor`) never includes a
  // synthetic flea-market pseudo-vendor entry, so every entry is a real
  // trader offer with these fields. Kept optional rather than tightened to
  // required, since nothing downstream depends on that guarantee holding.
  minTraderLevel?: number;
  taskUnlock?: { id: string; name: string } | null;
  buyLimit?: number | null;
}
export interface RawBuyForEntry {
  priceRUB: number;
  currency: string;
  vendor: RawBuyForVendor;
}
export interface RawItem {
  id: string;
  name: string;
  shortName: string;
  iconLink: string | null;
  wikiLink: string | null;
  basePrice: number;
  avg24hPrice: number | null;
  lastLowPrice: number | null;
  changeLast48hPercent: number | null;
  width: number;
  height: number;
  types: readonly string[];
  sellFor: readonly RawSellForEntry[];
  buyFor: readonly RawBuyForEntry[];
}
export interface RawItemPve {
  id: string;
  avg24hPrice: number | null;
  lastLowPrice: number | null;
  changeLast48hPercent: number | null;
}

export interface RawMapBoss {
  /** Resolved display name (e.g. "Glukhar"); falls back to the raw mob-id code when the mob lookup misses. */
  name: string;
  /** Mob-id normalized name (e.g. "glukhar"), stable across wipes, handy as a key/asset lookup. */
  normalizedName: string;
  /** Face-portrait asset URL, or `null` when the mob has none. */
  imagePortraitLink: string | null;
  /** 0..1 spawn probability. */
  spawnChance: number;
}
export interface RawMap {
  name: string;
  normalizedName: string;
  /** The game's own internal location id (e.g. `"RezervBase"`), the join key for anything read out of EFT's logs. `null` when upstream omits it. */
  nameId: string | null;
  raidDuration: number | null;
  players: string | null;
  bosses: readonly RawMapBoss[];
}

export interface RawTrader {
  id: string;
  name: string;
  normalizedName: string;
  imageLink: string | null;
}

export interface RawBarterCraftItemRef {
  item: RawItemRef;
  count: number;
}
export interface RawBarter {
  id: string;
  level: number;
  trader: { name: string; normalizedName: string };
  requiredItems: readonly RawBarterCraftItemRef[];
  rewardItems: readonly RawBarterCraftItemRef[];
}
export interface RawCraft {
  id: string;
  level: number;
  duration: number;
  station: { name: string; normalizedName: string };
  requiredItems: readonly RawBarterCraftItemRef[];
  rewardItems: readonly RawBarterCraftItemRef[];
}

export interface RawTarkovApiResponseData {
  tasks: readonly RawTask[];
  /** PvE-tagged tasks; see `useActiveModeTasks` (`features/progress-tracker/hooks`) for how a consumer picks between this and `tasks`. */
  tasksPve: readonly RawTask[];
  hideoutStations: readonly RawHideoutStation[];
  items: readonly RawItem[];
  itemsPve: readonly RawItemPve[];
  maps: readonly RawMap[];
  traders: readonly RawTrader[];
  barters: readonly RawBarter[];
  crafts: readonly RawCraft[];
}

// ─── Normalized/public types ────────────────────────────────────────────
// Only items and tasks receive real transformation (PvE-price merge/
// trader-price computation/slimming for items; requirement-dedup/quest-tool
// filtering for tasks). hideoutStations/traders/barters/crafts/maps are
// already exactly the shape the app needs as selected by the query, so
// TarkovGameData reuses their Raw* type directly rather than introducing
// pointless duplicate interfaces.

/** One trader's buy offer for an item, as shown in an item-detail "where to buy" list. */
export interface TraderBuyOffer {
  vendor: string;
  vendorKey: string;
  priceRUB: number;
  minTraderLevel: number;
  taskUnlockId: string;
  taskUnlockName: string;
  buyLimit: number;
}

/**
 * `traderSell`/`traderBuy` are `0` when no trader offer exists; consumers
 * must treat `0` as "no trader deal," not a real price of zero roubles
 * (matches legacy's `fmtTraderPrice(n)` convention: `n > 0 ? price : "N/A"`).
 */
export interface NormalizedItem {
  id: string;
  name: string;
  shortName: string;
  iconLink: string | null;
  wikiLink: string | null;
  basePrice: number;
  width: number;
  height: number;
  avg24hPrice: number | null;
  lastLowPrice: number | null;
  changeLast48hPercent: number | null;
  types: readonly string[];
  traderSell: number;
  traderSellVendor: string;
  traderBuy: number;
  traderBuyVendor: string;
  buyOffers: readonly TraderBuyOffer[];
  avg24hPve: number | null;
  lastLowPve: number | null;
  changePve: number | null;
}

export interface TaskItemRequirement {
  id: string;
  name: string;
  shortName: string;
  iconLink: string | null;
  count: number;
  foundInRaid: boolean;
}

/** A fully-evaluable trader-loyalty gate (every field from {@link RawTraderRequirement} confirmed non-null). */
export interface TraderRequirement {
  traderId: string;
  traderName: string;
  /** Widened rather than enum-locked to `"level" | "reputation"`: tarkov.dev can introduce new requirement types without this app's types going stale. */
  requirementType: string;
  compareMethod: string;
  value: number;
}

export interface NormalizedTask {
  id: string;
  name: string;
  kappaRequired: boolean;
  /** See {@link RawTask.hasHiddenRequirement}. */
  hasHiddenRequirement: boolean;
  minPlayerLevel: number;
  experience: number;
  wikiLink: string | null;
  factionName: string | null;
  taskImageLink: string | null;
  /** Seconds after a prerequisite completes before this task actually unlocks. `0` when not delay-gated (defaulted from a `null` wire value too; see {@link RawTask}). */
  availableDelaySecondsMin: number;
  availableDelaySecondsMax: number;
  restartable: boolean;
  lightkeeperRequired: boolean;
  /** `null` when the task has no Prestige gate. See {@link RawTask.requiredPrestige} for the confirmed semantics. */
  requiredPrestigeLevel: number | null;
  trader: { id: string; name: string; imageLink: string | null };
  /** Deduped `normalizedName` set: `task.map` plus every objective's `maps`. */
  maps: readonly string[];
  taskRequirements: readonly { taskId: string; status: readonly string[] }[];
  traderRequirements: readonly TraderRequirement[];
  /** Pass-through: task detail views need the raw item/markerItem refs, not just the deduped `itemRequirements` summary below. */
  objectives: readonly RawTaskObjective[];
  failConditions: readonly RawTaskObjective[];
  startRewards: RawFinishRewards | null;
  finishRewards: RawFinishRewards | null;
  failureOutcome: RawFinishRewards | null;
  itemRequirements: readonly TaskItemRequirement[];
}

/** The fully fetched + normalized tarkov.dev dataset `useTarkovGameData()` resolves to. */
export interface TarkovGameData {
  /** Regular/PvP tasks. Also what Seasonal PvP falls back to; see `tasksPve`'s doc comment. */
  tasks: readonly NormalizedTask[];
  /**
   * PvE-tagged tasks: real, distinct data (not just a price overlay),
   * fetched from tarkov.dev's own `pve` `GameMode` tag. There is deliberately
   * NO equivalent `tasksSeasonal` field: tarkov.dev's `GameMode` enum is
   * confirmed against its live schema to only have `regular`/`pve`; no
   * `season` value exists upstream, so nothing can be fetched for it yet.
   * Consumers needing Seasonal-mode tasks should read `tasks` (the
   * regular/PvP list) via `useActiveModeTasks()` and treat its
   * `isAccurateForMode: false` as a signal to show a "not verified for
   * Season yet" note, rather than presenting borrowed PvP data as confirmed
   * Seasonal content.
   */
  tasksPve: readonly NormalizedTask[];
  hideoutStations: readonly RawHideoutStation[];
  items: readonly NormalizedItem[];
  traders: readonly RawTrader[];
  barters: readonly RawBarter[];
  crafts: readonly RawCraft[];
  maps: readonly RawMap[];
}
