/** The minimal item shape `isQuestTool` needs to classify an item. */
export interface QuestToolCandidate {
  name: string;
  shortName: string;
}

/**
 * True for items that only exist to be planted/used during a quest
 * objective (MS2000 markers, signal jammers, wifi cameras, the "Kerman's
 * cat" hologram) rather than genuinely collectible loot. Ported verbatim
 * from `old/TarkovTrackerWB-main/src/lib/flea.js`'s `isQuestTool`, where
 * it's used to exclude these from a task's item-requirement list.
 */
export function isQuestTool(item: QuestToolCandidate | null | undefined): boolean {
  if (!item) return false;
  const name = (item.name || "").toLowerCase();
  const shortName = (item.shortName || "").toLowerCase();
  return (
    name.includes("ms2000") ||
    shortName === "ms2000" ||
    shortName === "marker" ||
    name.includes("signal jammer") ||
    shortName === "jammer" ||
    /\bwi-?fi camera\b/.test(name) ||
    /wifi.?cam/.test(shortName) ||
    /\bkerman'?s cat\b/.test(name) ||
    name.includes("hologram")
  );
}

/** The minimal item shape `isMoneyItem` needs to classify an item. */
export interface MoneyItemCandidate {
  types: readonly string[];
  shortName: string;
}

const MONEY_SHORTNAME_FALLBACK = new Set(["rub", "usd", "eur"]);

/**
 * True for currency items (Roubles/Dollars/Euros). Ported from legacy's
 * `itemAdjust.js`'s `isMoneyShort`: primarily checks `types` for tarkov.dev's
 * `"money"` tag, falling back to a `shortName` check in case `types` isn't
 * populated. Used to decide whether `ItemRow` shows the money-specific
 * Fill/Clear controls instead of the generic +/- pending stepper.
 */
export function isMoneyItem(item: MoneyItemCandidate): boolean {
  if (item.types.some((type) => type.toLowerCase() === "money")) return true;
  return MONEY_SHORTNAME_FALLBACK.has(item.shortName.toLowerCase());
}

/** The minimal item shape `isBarterOnly` needs to classify an item. */
export interface BarterOnlyCandidate {
  types: readonly string[];
}

const BARTER_ONLY_EXCLUDED_TYPES = new Set([
  "armor",
  "armorPlate",
  "rig",
  "backpack",
  "glasses",
  "grenade",
  "gun",
  "headphones",
  "headwear",
  "helmet",
  "preset",
  "suppressor",
  "pistolGrip",
  "mods",
  "wearable",
  "ammo",
  "ammoBox",
  "keys",
]);

/**
 * True for items that are genuinely "barter loot": carries tarkov.dev's
 * `"barter"` type and none of the equipment/weapon/ammo/key categories that
 * would otherwise slip through (a barter-tagged rig or gun is still
 * equipment, not the kind of grabbable valuable this panel means). Ported
 * verbatim from `old/TarkovTrackerWB-main/src/lib/flea.js`'s `isBarterOnly`.
 * Medical barter items (LEDX, Ophthalmoscope, Defib) pass because they carry
 * both `"meds"` and `"barter"` types on tarkov.dev.
 */
export function isBarterOnly(item: BarterOnlyCandidate | null | undefined): boolean {
  const types = item?.types ?? [];
  if (!types.includes("barter")) return false;
  return !types.some((type) => BARTER_ONLY_EXCLUDED_TYPES.has(type));
}

/** The minimal item shape `isDogtag` needs to classify an item. */
export interface DogtagCandidate {
  name: string;
}

/**
 * True for BEAR/USEC dogtags (every level bracket, ~30 variants). Excluded
 * from valuables lists because dogtags come from killing PMCs, not map loot
 * containers, even though they carry the `"barter"` type and some brackets
 * sit at high prices. Ported verbatim from `flea.js`'s `isDogtag`.
 */
export function isDogtag(item: DogtagCandidate | null | undefined): boolean {
  if (!item) return false;
  return /\bdogtag/i.test(item.name || "");
}
