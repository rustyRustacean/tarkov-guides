/** The single GraphQL endpoint every tarkov.dev query in this app hits. No API key/auth is required. */
export const TARKOV_API_ENDPOINT = "https://api.tarkov.dev/graphql";

/**
 * Originally ported verbatim from `old/TarkovTrackerWB-main/src/lib/refreshData.js`'s
 * `GQL_QUERY` - the sole GraphQL query in either legacy codebase (confirmed
 * via exhaustive grep; `old/tarkov-tips` has no fetch/GraphQL code of its
 * own). Do not reformat/reorder the field selections without re-verifying
 * against the legacy source - this is data-shape-critical, not style.
 *
 * The `tasks` field selection was extended beyond the legacy port
 * (2026-07-16 task-data audit) with `availableDelaySecondsMin/Max`,
 * `requiredPrestige`, `restartable`, `lightkeeperRequired`, `startRewards`,
 * `failConditions`, `failureOutcome` - all confirmed via live schema
 * introspection against `api.tarkov.dev` before adding, not guessed. Every
 * addition was verified end-to-end against a real live query (not just
 * typed blind) - see that audit's findings for exact real task ids/values
 * used to confirm each field.
 */
export const TARKOV_GQL_QUERY = `query {
  tasks(lang: en, gameMode: regular) {
    id name kappaRequired minPlayerLevel wikiLink factionName experience
    taskImageLink
    availableDelaySecondsMin availableDelaySecondsMax
    restartable
    lightkeeperRequired
    requiredPrestige { prestigeLevel }
    trader { id name imageLink }
    map { name normalizedName }
    taskRequirements { task { id } status }
    traderRequirements { id trader { id name } requirementType compareMethod value }
    objectives {
      id type description optional
      maps { normalizedName }
      ... on TaskObjectiveItem {
        item { id name shortName iconLink }
        count foundInRaid
        zones { id map { normalizedName } position { x y z } }
      }
      ... on TaskObjectiveMark {
        markerItem { id name shortName iconLink }
        zones { id map { normalizedName } position { x y z } }
      }
      ... on TaskObjectiveBasic {
        zones { id map { normalizedName } position { x y z } }
      }
      ... on TaskObjectiveShoot {
        zones { id map { normalizedName } position { x y z } }
      }
      ... on TaskObjectiveQuestItem {
        zones { id map { normalizedName } position { x y z } }
      }
      ... on TaskObjectiveUseItem {
        zones { id map { normalizedName } position { x y z } }
      }
    }
    failConditions {
      id type description optional
      maps { normalizedName }
      ... on TaskObjectiveItem {
        item { id name shortName iconLink }
        count foundInRaid
        zones { id map { normalizedName } position { x y z } }
      }
      ... on TaskObjectiveMark {
        markerItem { id name shortName iconLink }
        zones { id map { normalizedName } position { x y z } }
      }
      ... on TaskObjectiveBasic {
        zones { id map { normalizedName } position { x y z } }
      }
      ... on TaskObjectiveShoot {
        zones { id map { normalizedName } position { x y z } }
      }
      ... on TaskObjectiveQuestItem {
        zones { id map { normalizedName } position { x y z } }
      }
      ... on TaskObjectiveUseItem {
        zones { id map { normalizedName } position { x y z } }
      }
    }
    startRewards {
      items          { item { id name shortName iconLink basePrice } count }
      traderStanding { trader { name } standing }
      traderUnlock   { name }
      offerUnlock    { trader { name } level item { name shortName iconLink } }
      skillLevelReward { name level }
    }
    finishRewards {
      items          { item { id name shortName iconLink basePrice } count }
      traderStanding { trader { name } standing }
      traderUnlock   { name }
      offerUnlock    { trader { name } level item { name shortName iconLink } }
      skillLevelReward { name level }
    }
    failureOutcome {
      items          { item { id name shortName iconLink basePrice } count }
      traderStanding { trader { name } standing }
      traderUnlock   { name }
      offerUnlock    { trader { name } level item { name shortName iconLink } }
      skillLevelReward { name level }
    }
  }
  hideoutStations {
    id name normalizedName
    levels {
      level
      itemRequirements { item { id name shortName iconLink } count }
      stationLevelRequirements { station { normalizedName } level }
    }
  }
  items(lang: en) {
    id name shortName iconLink wikiLink
    basePrice avg24hPrice lastLowPrice changeLast48hPercent
    width height
    types
    sellFor { priceRUB vendor { name normalizedName } }
    buyFor  {
      priceRUB currency
      vendor {
        name normalizedName
        ... on TraderOffer {
          minTraderLevel
          taskUnlock { id name }
          buyLimit
        }
      }
    }
  }
  itemsPve: items(lang: en, gameMode: pve) {
    id avg24hPrice lastLowPrice changeLast48hPercent
  }
  maps(lang: en) {
    name normalizedName
    raidDuration
    players
    bosses {
      name
      spawnChance
      spawnLocations { name chance }
    }
  }
  traders(lang: en) {
    id name normalizedName imageLink
  }
  barters {
    id level
    trader { name normalizedName }
    requiredItems { item { id name shortName iconLink } count }
    rewardItems  { item { id name shortName iconLink } count }
  }
  crafts {
    id level duration
    station { name normalizedName }
    requiredItems { item { id name shortName iconLink } count }
    rewardItems  { item { id name shortName iconLink } count }
  }
}`;

/** React Query key for `useTarkovGameData()` - shared so callers can read the cache directly (e.g. `merge-with-previous.ts`). */
export const TARKOV_GAME_DATA_QUERY_KEY = ["tarkov-game-data"] as const;
export const REVALIDATE_SECONDS = 60 * 60;
