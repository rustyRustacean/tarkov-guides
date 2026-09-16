// ─── Wire types for tarkov.dev's JSON API ───────────────────────────────
// Reverse-engineered directly from real live responses (`json.tarkov.dev`),
// not from any published schema (none exists; the API's own maintainers
// describe it as "still a work in progress"). Only fields this app actually
// reads are typed; the live payloads carry many more (e.g. item `properties`,
// map `lootContainers`/`extracts`, trader `reputationLevels`) that aren't
// selected here because nothing downstream of `join-json-api-data.ts`
// consumes them, and the old GraphQL query didn't select their equivalents
// either. Every cross-reference (an item/trader/task/station/map elsewhere
// in this payload) is a **bare id string**; this is the core difference
// from GraphQL, which pre-joined these as nested objects. Resolving those
// ids back into the nested shape this app's `Raw*` types (`types.ts`)
// expect is `join-json-api-data.ts`'s job, not this file's.

/** Every translatable resource's envelope: `data` (the real payload, with placeholder-key text pre-translation) plus the JSONPath list identifying which fields hold translation keys. */
export interface JsonApiEnvelope<T> {
  data: T;
  translations: readonly string[];
}

/** A `{resource}_{lang}` translation-dictionary response: flat key→translated-string map, deduped across the whole resource payload (e.g. a weapon-mod slot name shared by hundreds of items appears once). */
export interface JsonApiTranslationDict {
  data: Record<string, string>;
}

// ─── items ───────────────────────────────────────────────────────────────

export interface JsonApiTraderOffer {
  trader: string;
  priceRUB: number;
  currency: string;
  minTraderLevel: number;
  /** Task id, or `null` when the offer isn't gated behind a quest unlock. */
  taskUnlock: string | null;
  buyLimit: number | null;
}

export interface JsonApiSellOffer {
  trader: string;
  priceRUB: number;
}

export interface JsonApiItem {
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
  // Optional rather than required, though conceptually always-present
  // fields: a real live fetch confirmed at least one real item can omit
  // `sellToTrader` entirely rather than sending `[]`. This API is
  // explicitly "still a work in progress" per tarkov.dev's own staff, so
  // every array field here is optional defensively, not just the ones
  // caught missing so far. `join-json-api-data.ts` treats a missing array
  // the same as an empty one.
  types?: readonly string[];
  /** No synthetic `"flea-market"` entry here (unlike the old GraphQL `sellFor`): flea prices are the separate `avg24hPrice`/`lastLowPrice` fields above, same as today. */
  buyFromTrader?: readonly JsonApiTraderOffer[];
  sellToTrader?: readonly JsonApiSellOffer[];
}

export interface JsonApiItemsData {
  items: Record<string, JsonApiItem>;
}

// ─── traders ─────────────────────────────────────────────────────────────

export interface JsonApiTrader {
  id: string;
  name: string;
  normalizedName: string;
  imageLink: string | null;
}

/** `/traders`'s `data` is already the id-keyed trader map directly (no extra nesting level, unlike `items`/`tasks`). */
export type JsonApiTradersData = Record<string, JsonApiTrader>;

// ─── hideout ─────────────────────────────────────────────────────────────

export interface JsonApiHideoutItemRequirement {
  item: string;
  count: number;
}

export interface JsonApiHideoutStationLevelRequirement {
  station: string;
  level: number;
}

export interface JsonApiHideoutLevel {
  level: number;
  itemRequirements?: readonly JsonApiHideoutItemRequirement[];
  stationLevelRequirements?: readonly JsonApiHideoutStationLevelRequirement[];
}

export interface JsonApiHideoutStation {
  id: string;
  name: string;
  normalizedName: string;
  levels?: readonly JsonApiHideoutLevel[];
}

export type JsonApiHideoutData = Record<string, JsonApiHideoutStation>;

// ─── maps ────────────────────────────────────────────────────────────────

/**
 * One boss-spawn entry on a map, as the live JSON API actually ships it
 * (verified against `https://json.tarkov.dev/regular/maps`): `mob` is a
 * mob-id code (e.g. `"bossGluhar"`) that resolves to display name +
 * portrait via the sibling {@link JsonApiMapsData.mobs} lookup, and
 * `spawnChance` is a 0..1 fraction. The old GraphQL schema's flattened
 * `name`/`spawnLocations` fields are NOT present here; an early assumed
 * shape that left boss pills reading "undefined".
 */
export interface JsonApiMapBoss {
  mob: string;
  spawnChance: number;
}

export interface JsonApiMap {
  name: string;
  normalizedName: string;
  /** The game's own internal location id (e.g. `"RezervBase"`, `"factory4_night"`), what EFT writes into its logs. Optional: a partial/legacy payload may omit it. */
  nameId?: string;
  raidDuration: number | null;
  players: string | null;
  bosses?: readonly JsonApiMapBoss[];
}

/**
 * Mob/boss metadata shipped alongside the maps in the same payload, keyed by
 * mob id. `name` arrives as a translation key (e.g. `"bossGluhar"`) that the
 * shared translation pass resolves to the real display name ("Glukhar") via
 * the envelope's `$.data.mobs.*.name` path before the join runs.
 */
export interface JsonApiMob {
  id: string;
  name: string;
  normalizedName: string;
  imagePortraitLink: string | null;
}

/**
 * Unlike `traders`/`hideout` (whose `data` is the id-keyed record directly),
 * `maps`' `data` nests the record one level deeper under a `maps` key,
 * confirmed against the real live payload, not assumed consistent with its
 * siblings (this API is explicitly "still a work in progress" per
 * tarkov.dev's own staff).
 */
export interface JsonApiMapsData {
  maps: Record<string, JsonApiMap>;
  /** Mob-id → metadata, used to resolve each boss's `mob` code to a name + portrait. Optional: a partial/legacy payload may omit it. */
  mobs?: Record<string, JsonApiMob>;
}

// ─── barters / crafts (translations: false, no `_{lang}` companion fetch) ─

export interface JsonApiItemStack {
  item: string;
  count: number;
}

export interface JsonApiBarter {
  id: string;
  level: number;
  trader: string;
  requiredItems?: readonly JsonApiItemStack[];
  offeredItem: JsonApiItemStack;
}

export type JsonApiBartersData = readonly JsonApiBarter[];

export interface JsonApiCraft {
  id: string;
  level: number;
  duration: number;
  station: string;
  requiredItems?: readonly JsonApiItemStack[];
  productItem: JsonApiItemStack;
}

export type JsonApiCraftsData = readonly JsonApiCraft[];

// ─── tasks ───────────────────────────────────────────────────────────────

/**
 * `giveItem`/`findItem`/`plantItem`/`sellItem` objectives carry an
 * `items: [id, ...]` **set of alternatives** (e.g. "hand over any 3
 * found-in-raid medicine items" lists ~50 acceptable items), a real schema
 * difference from the old GraphQL query's single `item` ref. This app takes
 * `items[0]` as the representative item, matching its existing
 * one-item-per-requirement-row model everywhere else.
 */
export interface JsonApiTaskObjective {
  id: string;
  description: string;
  type: string;
  optional: boolean;
  count?: number;
  foundInRaid?: boolean;
  items?: readonly string[];
  /** Set on `mark` objectives only. */
  markerItem?: string;
  /** Set on `findQuestItem`/`giveQuestItem`/`plantQuestItem` objectives: references `data.questItems`, a collection this app doesn't otherwise consume (never resolved to a name anywhere downstream, matching the old GraphQL port's behavior). */
  questItem?: string;
  zones?: readonly {
    id: string;
    map: string | null;
    position: { x: number; y: number; z: number } | null;
  }[];
  /** `findQuestItem`'s equivalent of `zones`: a differently-shaped/named field carrying the same kind of in-raid position data. */
  possibleLocations?: readonly {
    map: string;
    positions: readonly { x: number; y: number; z: number }[];
  }[];
  maps?: readonly string[];
}

export interface JsonApiTaskItemReward {
  item: string;
  count: number;
}
export interface JsonApiTaskTraderStandingReward {
  trader: string;
  standing: number;
}
export interface JsonApiTaskOfferUnlockReward {
  trader: string;
  level: number;
  item: string;
}
export interface JsonApiTaskSkillLevelReward {
  skill: string;
  level: number;
}
export interface JsonApiTaskRewards {
  items?: readonly JsonApiTaskItemReward[];
  traderStanding?: readonly JsonApiTaskTraderStandingReward[];
  /** Bare trader ids, unlike every other reward bucket's `{...}` shape. */
  traderUnlock?: readonly string[];
  offerUnlock?: readonly JsonApiTaskOfferUnlockReward[];
  skillLevelReward?: readonly JsonApiTaskSkillLevelReward[];
}

export interface JsonApiTraderRequirement {
  id: string | null;
  trader: string;
  requirementType: string | null;
  compareMethod: string | null;
  value: number | null;
}

/**
 * A gate the live API can no longer express as a `taskRequirements` entry:
 * `type: "globalVariable"` references an internal BSG progression counter
 * (`variableId`/`compareMethod`/`value`) this app has no way to evaluate.
 * Confirmed mutually exclusive with `taskRequirements` on every real task
 * (100% of tasks carrying one have zero of the other) across the live
 * dataset, 2026-08-13. `type: "dialogue"` also occurs but is rarer and
 * equally unevaluable; both are only ever surfaced as a single "hidden
 * requirement exists" boolean (see `hasHiddenRequirement` on `RawTask`),
 * never as a real gate.
 */
export interface JsonApiOtherRequirement {
  type: string;
  variableId?: string;
  compareMethod?: string;
  value?: number;
}

export interface JsonApiTask {
  id: string;
  name: string;
  kappaRequired: boolean;
  minPlayerLevel: number | null;
  experience: number;
  wikiLink: string | null;
  factionName: string | null;
  taskImageLink: string | null;
  availableDelaySecondsMin: number | null;
  availableDelaySecondsMax: number | null;
  restartable: boolean | null;
  lightkeeperRequired: boolean | null;
  /** Id into this same payload's `data.prestige[]`, resolved to a `prestigeLevel` number during the join step, not usable directly (unlike the old GraphQL query's already-resolved `{prestigeLevel}` shape). */
  requiredPrestige: string | null;
  trader: string;
  map: string | null;
  taskRequirements?: readonly { task: string; status?: readonly string[] }[];
  traderRequirements?: readonly JsonApiTraderRequirement[];
  otherRequirements?: readonly JsonApiOtherRequirement[];
  objectives?: readonly JsonApiTaskObjective[];
  failConditions?: readonly JsonApiTaskObjective[];
  startRewards: JsonApiTaskRewards | null;
  finishRewards: JsonApiTaskRewards | null;
  failureOutcome: JsonApiTaskRewards | null;
}

export interface JsonApiPrestigeTier {
  id: string;
  prestigeLevel: number;
}

export interface JsonApiTasksData {
  tasks: Record<string, JsonApiTask>;
  prestige?: readonly JsonApiPrestigeTier[];
}
