import type { RawItem, RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";

const PRAPOR_ID = "prapor-id";

function itemFixture(id: string, name: string, shortName: string): RawItem {
  return {
    id,
    name,
    shortName,
    iconLink: null,
    wikiLink: null,
    basePrice: 1000,
    avg24hPrice: 1200,
    lastLowPrice: 1150,
    changeLast48hPercent: 0,
    width: 1,
    height: 1,
    types: [],
    sellFor: [],
    buyFor: [],
  };
}

function findItemObjective(itemId: string, itemName: string, itemShortName: string) {
  return {
    id: `obj-${itemId}`,
    type: "findItem",
    description: `Find ${itemName} in raid`,
    optional: false,
    maps: [],
    item: { id: itemId, name: itemName, shortName: itemShortName, iconLink: null },
    count: 1,
    foundInRaid: false,
  };
}

function taskFixture(id: string, name: string, itemId: string, itemName: string): RawTask {
  return {
    id,
    name,
    kappaRequired: false,
    minPlayerLevel: 1,
    experience: 100,
    wikiLink: null,
    factionName: null,
    taskImageLink: null,
    availableDelaySecondsMin: 0,
    availableDelaySecondsMax: 0,
    restartable: false,
    lightkeeperRequired: false,
    requiredPrestige: null,
    trader: { id: PRAPOR_ID, name: "Prapor", imageLink: null },
    map: null,
    taskRequirements: [],
    traderRequirements: [],
    objectives: [findItemObjective(itemId, itemName, itemName.slice(0, 2).toUpperCase())],
    failConditions: [],
    finishRewards: null,
    startRewards: null,
    failureOutcome: null,
  };
}

/**
 * A minimal, deterministic tarkov.dev dataset for e2e specs - two
 * independent tasks (no prerequisites, no trader-loyalty gates, so both are
 * immediately available to a fresh level-1 profile), each requiring one
 * item. Kept intentionally small: e2e specs test the app's own behavior
 * (persistence, undo, profile isolation), not tarkov.dev's live data, so a
 * real network dependency here would only add flakiness without adding
 * coverage - unlike the manual Playwright verification passes done during
 * development, which deliberately exercise the real live API.
 */
const TASKS = [
  taskFixture("task-alpha", "Secure the Alpha Widget", "item-alpha", "Alpha Widget"),
  taskFixture("task-beta", "Secure the Beta Widget", "item-beta", "Beta Widget"),
];

export const MOCK_TARKOV_DATA: RawTarkovApiResponseData = {
  tasks: TASKS,
  // Mirrors `tasks` - no e2e spec exercises PvE mode specifically, but
  // keeping both modes populated avoids an empty-task-list surprise if a
  // spec ever visits the app in PvE mode.
  tasksPve: TASKS,
  hideoutStations: [],
  items: [
    itemFixture("item-alpha", "Alpha Widget", "AW"),
    itemFixture("item-beta", "Beta Widget", "BW"),
  ],
  itemsPve: [
    { id: "item-alpha", avg24hPrice: 1200, lastLowPrice: 1150, changeLast48hPercent: 0 },
    { id: "item-beta", avg24hPrice: 900, lastLowPrice: 850, changeLast48hPercent: 0 },
  ],
  maps: [],
  traders: [{ id: PRAPOR_ID, name: "Prapor", normalizedName: "prapor", imageLink: null }],
  barters: [],
  crafts: [],
};
