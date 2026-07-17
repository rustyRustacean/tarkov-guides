/**
 * One curated beginner-item reference, resolved against live item data via
 * `resolveGameItem`/`resolveGameItems` (`src/shared/lib/item-resolution`).
 * Structurally identical to that module's `ItemResolutionSpec` - defined
 * locally rather than imported so `shared/data` stays a dependency-free
 * leaf with no imports from `shared/lib`.
 */
export interface BeginnerItemEntry {
  short?: string;
  nameLike?: string;
}

export interface BeginnerItemCategory {
  category: string;
  /** Short explanation of why this category matters early-wipe, shown alongside the item list. */
  why: string;
  items: readonly BeginnerItemEntry[];
}

/**
 * Curated "what to hoard in your first 2 weeks" list, ported verbatim from
 * `old/TarkovTrackerWB-main/src/data/beginnerItems.js`. Wiki/subreddit
 * consensus, not derived from any API - hand-authored guide content, not
 * a raw game-data dump. Entries resolve to a live item via
 * `resolveGameItems` (shortName-key lookup, then a `nameLike` substring
 * fallback); an entry that no longer resolves (tarkov.dev renamed/removed
 * the item) is silently dropped rather than erroring, matching legacy's
 * documented intent of not needing manual pruning as the game changes.
 */
export const BEGINNER_ITEMS: readonly BeginnerItemCategory[] = [
  {
    category: "Hideout essentials",
    why: "every build needs these · sell none until your hideout is max",
    items: [
      { short: "Tool", nameLike: "tool" },
      { short: "Wires", nameLike: "wires" },
      { short: "Caps", nameLike: "capacitors" },
      { short: "Bolts", nameLike: "bolts" },
      { short: "Screws", nameLike: "screws" },
      { short: "Nuts", nameLike: "nuts" },
      { short: "Fleece", nameLike: "fleece fabric" },
      { short: "Soap", nameLike: "soap" },
      { short: "Nails", nameLike: "nails" },
      { short: "Ductape", nameLike: "duct tape" },
      { short: "Bleach", nameLike: "bleach" },
      { short: "Toilet paper", nameLike: "toilet paper" },
      { short: "CPUfan", nameLike: "cpu fan" },
      { short: "PCB", nameLike: "printed circuit board" },
      { short: "Sugar", nameLike: "sugar" },
      { short: "Pliers", nameLike: "pliers" },
      { short: "Corrugated hose", nameLike: "corrugated hose" },
      { short: "Power cord", nameLike: "power cord" },
      { short: "MilCable", nameLike: "military cable" },
      { short: "Electric drill", nameLike: "electric drill" },
      { short: "Magnet", nameLike: "magnet" },
    ],
  },
  {
    category: "Early trader quests",
    why: "LL1–2 tasks ask for these on repeat · save one copy of each FIR",
    items: [
      { short: "LEDX", nameLike: "ledx" },
      { short: "Salewa", nameLike: "salewa" },
      { short: "IFAK", nameLike: "ifak" },
      { short: "AFAK", nameLike: "afak" },
      { short: "Car", nameLike: "car first aid" },
      { short: "Ophth", nameLike: "ophthalmoscope" },
      { short: "Defib", nameLike: "defibrillator" },
      { short: "GPU", nameLike: "graphics card" },
      { short: "RamPack", nameLike: "ram pack" },
      { short: "Metal scissors", nameLike: "metal scissors" },
      { short: "Propital", nameLike: "propital" },
      { short: "SJ1", nameLike: "sj1" },
      { short: "SJ6", nameLike: "sj6" },
      { short: "Morphine", nameLike: "morphine" },
    ],
  },
  {
    category: "Early flea flips (cash flow)",
    why: "easy money to fund gear while you level traders",
    items: [
      { short: "Cans of beef", nameLike: "can of beef" },
      { short: "Tushonka", nameLike: "tushonka" },
      { short: "Iskra", nameLike: "iskra" },
      { short: "MRE", nameLike: "mre" },
      { short: "Chocolate", nameLike: "bars-a chocolate" },
      { short: "Vodka", nameLike: "russian standard vodka" },
      { short: "Whiskey", nameLike: "whiskey" },
      { short: "Moonshine", nameLike: "moonshine" },
      { short: "Wilston", nameLike: "wilston" },
      { short: "Strike", nameLike: "strike" },
    ],
  },
  {
    category: "Barter targets (save these)",
    why: "feed specific trader barters for gear discounts",
    items: [
      { short: "PCB", nameLike: "printed circuit board" },
      { short: "Gas analyzer", nameLike: "gas analyzer" },
      { short: "DVL", nameLike: "dvl-10" },
      { short: "Paracord", nameLike: "paracord" },
      { short: "Gpowder", nameLike: "gunpowder" },
      { short: "OFZ", nameLike: "ofz 30mm" },
      { short: "Intel", nameLike: "intelligence folder" },
      { short: "BTC", nameLike: "physical bitcoin" },
      { short: "Dogtag", nameLike: "dogtag" },
    ],
  },
];
