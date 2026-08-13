/**
 * One curated "where to find this item" entry. Structurally identical to
 * `src/shared/lib/item-resolution/find-item-location-entry.ts`'s
 * `ItemLocationEntry`, defined locally rather than imported so
 * `shared/data` stays a dependency-free leaf with no imports from
 * `shared/lib`.
 */
export interface ItemLocationEntry {
  match: readonly string[];
  general: string;
  perMap: Readonly<Record<string, string>>;
}

/**
 * Curated per-item, per-map "where to find" hints, ported verbatim from
 * `old/TarkovTrackerWB-main/src/data/itemLocations.js`'s `ITEM_LOCATIONS`.
 * Hand-authored from community consensus (wiki, subreddit, streamer
 * guides), not derived from any API, stable across wipes. Keyed by a
 * curated shorthand (not a tarkov.dev item id); resolve a live item to its
 * entry via `findItemLocationEntry` (`src/shared/lib/item-resolution`).
 *
 * Reshaped from legacy's flat `{_match, _general, customs, reserve, ...}`
 * object (the underscore prefixes there work around that file having no
 * type system) into `{match, general, perMap}`; every string value is
 * ported verbatim, only the container shape changes. Coverage focus:
 * hideout essentials, medical, electronics, valuables, barter/quest
 * staples, and provisions; generic ammo/weapon mods are intentionally
 * omitted (no useful map specificity).
 */
export const ITEM_LOCATIONS: Readonly<Record<string, ItemLocationEntry>> = {
  ledx: {
    match: ["ledx"],
    general:
      "Medbags + pharmacy spawns only. Extremely rare - worth 200k+ FIR. Always FIR-hand-in priority.",
    perMap: {
      customs: "New gas station medical · ZB-013 medbags · saferoom med spawns",
      reserve: "D-2 medical · hermetic door 2 · field medic crates · barracks med",
      woods: "Scav house medbag · UN camp medbags · USEC camp · outskirts med",
      "streets-of-tarkov":
        "Primorsky clinic med storage · Cardinal pharmacy · Pinewood pharmacy · Concordia upper floors",
      shoreline: "Resort east 222/226 med storage · west 303/306 · village pharmacy · pier medical",
      interchange: "IDEA medical aisle · Kiba medbag · Rasmussen first-aid",
      lighthouse: "Water treatment med · Rogue chalet pharmacy · village medical",
      "the-lab": "Medical storage rooms · R&D zone medical · black keycard med room",
      "ground-zero": "Infirmary medbags · medical bay drawers · pharmacy desks",
    },
  },
  ophth: {
    match: ["ophthalmoscope"],
    general:
      "Medbags + pharmacy + first-aid kit spawns. Therapist barter for Bitcoin farm prereqs.",
    perMap: {
      customs: "New gas station med room · ZB-013 medbags",
      reserve: "D-2 medical bags · hermetic corner medical",
      woods: "UN camp medbag · PMC extract medbags",
      "streets-of-tarkov": "Pharmacies · Primorsky clinic · Concordia med",
      shoreline: "Resort medbags · village medical · pier first-aid",
      interchange: "Medbags across mall · IDEA medical · Mantis pharmacy",
      lighthouse: "Water treatment medical · chalet med · village",
      "the-lab": "Medbags throughout labs · R&D medical",
      "ground-zero": "Infirmary · medical bay · pharmacy",
    },
  },
  defib: {
    match: ["defibrillator"],
    general: "Medbags + medical drawers. Quest item for Therapist (Healthcare Privatization).",
    perMap: {
      customs: "Trailer park medical · sniper gully medbag · truck cabinets",
      reserve: "D-2 medical · hermetic 2 medbags · field medic crate",
      shoreline: "Resort medical cabinets · village med · pier",
      interchange: "Kiba medbag · Mantis medical aisle · Rasmussen",
      "streets-of-tarkov": "Pharmacies · Primorsky clinic · Concordia medical",
      woods: "UN camp medbags · scav house med spawns",
      lighthouse: "Water treatment med · chalet pharmacy",
      "the-lab": "Medical storage · R&D zone medbags",
    },
  },
  salewa: {
    match: ["salewa"],
    general: "Common medbag + drawer spawn - Therapist LL2 buy is reliable.",
    perMap: {
      customs: "Big medical bag · drawer spawns · dorms medical cabinets",
      reserve: "Barracks medbags · railway medical",
      shoreline: "Resort + village medbags · pier first-aid",
      interchange: "IDEA medical aisle · pharmacy spawns",
      "streets-of-tarkov": "Clinics · pharmacy spawns · apartment medbags",
      woods: "Medbags throughout · scav house · UN camp",
      lighthouse: "Village + chalet med · water treatment",
    },
  },
  ifak: {
    match: ["ifak personal"],
    general: "Drawer + jacket + medbag spawns everywhere. Both Therapist and Ragman barters/sells.",
    perMap: {},
  },
  afak: {
    match: ["afak tactical"],
    general: "Pouch/drawer spawns + medbags. Therapist LL3 unlocks the buy - cheap there.",
    perMap: {},
  },
  car: {
    match: ["car first aid"],
    general: "Drawers + cars + jackets across every map. Therapist sells cheap from LL1.",
    perMap: {},
  },
  morphine: {
    match: ["morphine"],
    general: "Medbag + drawer spawns. Therapist LL2 sell. Pre-raid pain killer of choice.",
    perMap: {
      customs: "Drawers + medbags · dorms · big red building",
      shoreline: "Resort first-aid spawns · village med · pier",
      "streets-of-tarkov": "Pharmacy + clinic spawns",
    },
  },
  sj1: {
    match: ["sj1 tgla"],
    general: "Drug spawns: scav drawers + medbags. Random raider/PMC kills.",
    perMap: {},
  },
  sj6: {
    match: ["sj6 tgla"],
    general: "Drug spawns: scav drawers + medbags. Random raider/PMC kills.",
    perMap: {},
  },
  propital: {
    match: ["propital"],
    general: "Drawers + medbags. Used in many quest hand-ins (Painkiller etc).",
    perMap: {},
  },
  mscissor: {
    match: ["metal scissors"],
    general: "Drawers + tool spots + jackets. Therapist sells from LL1.",
    perMap: {},
  },
  pmedrf: {
    match: ["pile of meds"],
    general: "Medbags + jacket spawns. Quest item - Therapist hand-in.",
    perMap: {},
  },
  analg: {
    match: ["analgin"],
    general: "Medbags + drawer spawns. Common drug item.",
    perMap: {},
  },
  gpu: {
    match: ["graphics card"],
    general: "Computer monitors only - single GPU per PC. Bitcoin farm fuel.",
    perMap: {
      customs: "Dorms 3F marked room · big red PC blocks · office PCs",
      reserve: "Bunker K PCs · D-2 computers · armory PC blocks",
      interchange: "Techlight every PC · power station · IDEA cashier · Mantis PCs",
      "streets-of-tarkov": "Lexos office PCs · Concordia PCs · Pinewood office PCs",
      lighthouse: "Water treatment PCs · chalet PCs · rogue base offices",
      "the-lab": "Office PCs · manager office · violet keycard area",
      "ground-zero": "Office PCs · admin building",
    },
  },
  virtex: {
    match: ["virtex"],
    general: "PC blocks only. Mechanic barter for Reap-IR - save 2-3.",
    perMap: {
      interchange: "Techlight PCs · Rasmussen · Mantis PC blocks",
      "streets-of-tarkov": "Lexos offices · Concordia PC blocks · Primorsky apartments",
      "the-lab": "Office PC blocks · R&D workstations",
    },
  },
  btc: {
    match: ["physical bitcoin"],
    general: "Safe spawns. Bitcoin farm produces them; rare in-world.",
    perMap: {
      reserve: "RB-KSM safes · armory safes · D-2 safes · marked room",
      "streets-of-tarkov": "Lexos safes · Primorsky apartment safes · Stylobat safes",
      interchange: "Kiba safes · Goshan safes · OLI cashier",
      "the-lab": "Safes · cashier · PC block desks",
    },
  },
  rampack: {
    match: ["ram pack", "rampack"],
    general: "PC monitors + toolboxes. Therapist + Mechanic barters.",
    perMap: {},
  },
  gasan: {
    match: ["gas analyzer"],
    general: "Toolboxes + cash registers. Skier quest staple.",
    perMap: {
      "streets-of-tarkov": "Toolboxes · cash registers · Pinewood workbenches",
      interchange: "Toolboxes across mall · OLI workbench · Kiba",
      customs: "Office toolboxes · gas station · construction site",
    },
  },
  cpufan: {
    match: ["cpu fan"],
    general: "PC interiors + toolboxes everywhere. Hideout build essential.",
    perMap: {
      interchange: "Toolboxes · PC blocks · Mantis tech aisle",
      "streets-of-tarkov": "PC block + toolbox spawns",
    },
  },
  pcb: {
    match: ["printed circuit board"],
    general: "Toolboxes + electronic spawns. Hideout build essential - hoard 30+.",
    perMap: {
      interchange: "Techlight · power station toolboxes · Mantis",
      "streets-of-tarkov": "Toolboxes · electronic spawn racks",
      customs: "Toolboxes + construction site + office spawns",
    },
  },
  wires: {
    match: ["wires"],
    general: "Toolboxes + jackets + scav backpacks. Cheap, but hoard for hideout.",
    perMap: {},
  },
  caps: {
    match: ["capacitors"],
    general: "Toolboxes + scav drops + PC blocks. Bitcoin farm + Intel center fuel.",
    perMap: {},
  },
  milcable: {
    match: ["military cable"],
    general: "Military toolboxes only. Long Russia quest line + multiple hideout levels.",
    perMap: {
      reserve: "Toolboxes · armory + bunker military crates · barracks",
      lighthouse: "Rogue base toolboxes · military crates · chalet workbenches",
      "the-lab": "Toolboxes · red keycard room · military crates",
    },
  },
  mcofdm: {
    match: ["military cofdm"],
    general: "Military toolboxes/crates only. Mechanic + Skier quest staple.",
    perMap: {
      reserve: "Bunker RB-key rooms · armory toolboxes · military crates",
      woods: "UN camp toolboxes · USEC camp military crates",
      lighthouse: "Rogue chalets toolboxes · military crates",
    },
  },
  powerc: {
    match: ["power cord"],
    general: "Toolboxes + electronic spawns + jackets. Hideout build.",
    perMap: {},
  },
  tplug: {
    match: ["t-shaped plug"],
    general: "Toolboxes + electronic spawns. Solar power station hideout requirement.",
    perMap: {},
  },
  phase: {
    match: ["phase control relay"],
    general: "Toolboxes + electronic crates. Hideout build (Vents/Heating).",
    perMap: {},
  },
  broken_lcd: {
    match: ["broken lcd"],
    general: "PC blocks + jacket + scav backpack spawns.",
    perMap: {},
  },
  dvr: {
    match: ["dvr with cable"],
    general: "PC blocks + electronic crates. Hideout Booze Generator.",
    perMap: {
      "streets-of-tarkov": "PC blocks · Lexos · Concordia",
      interchange: "Tech aisles + Techlight",
    },
  },
  damhdd: {
    match: ["damaged hard drive"],
    general: "Drawers + toolboxes + PC block spawns. Trader barter currency.",
    perMap: {},
  },
  iphone: {
    match: ["cellular phone"],
    general: "Pockets/drawers + safes. Often a quest hand-in.",
    perMap: {},
  },
  tool: {
    match: ["toolset", "tool set"],
    general: "Heavy toolboxes only - biggest hideout bottleneck after Caps. Hoard 6+ FIR.",
    perMap: {
      customs: "Construction site toolboxes · big red · office toolboxes",
      reserve: "Armory + bunker toolboxes · barracks workbenches",
      woods: "UN base toolboxes · scav house · rogue territory · chalets",
      lighthouse: "Rogue base toolboxes · chalets · water treatment",
      interchange: "OLI/Techlight toolboxes · garage · power station",
    },
  },
  pliers: {
    match: ["pliers"],
    general: "Toolboxes + workbenches everywhere. Hideout build essential.",
    perMap: {},
  },
  pliersel: {
    match: ["pliers elite", "hand drill"],
    general: "Toolboxes only - rare elite-tier. Hideout L3 builds.",
    perMap: {},
  },
  screws: {
    match: ["screws"],
    general: "Toolboxes + drawer + workbench spawns. Buy from Jaeger LL1 when desperate.",
    perMap: {},
  },
  bolts: {
    match: ["bolts"],
    general: "Toolboxes + workbench spawns. Hideout L1-2 essential.",
    perMap: {},
  },
  nuts: {
    match: ["nuts"],
    general: "Toolboxes + workbenches. Pair with Bolts on hideout build day.",
    perMap: {},
  },
  nails: {
    match: ["nails"],
    general: "Toolboxes + jackets. Cheap - Jaeger LL1 sells fine.",
    perMap: {},
  },
  ductape: {
    match: ["duct tape"],
    general: "Toolboxes + drawers everywhere. Hideout + medical crafts.",
    perMap: {},
  },
  edril: {
    match: ["electric drill"],
    general: "Tool spawns + workbenches. Hideout Workbench L1.",
    perMap: {},
  },
  magnet: {
    match: ["magnet"],
    general: "Tool spawns + scav backpacks. Hideout build.",
    perMap: {},
  },
  wrench: {
    match: ["wrench"],
    general: "Toolbox spawns + workbenches. Hideout + Mechanic quests.",
    perMap: {},
  },
  spplug: {
    match: ["spark plug"],
    general: "Toolboxes + cars + gas station. Hideout Booze Generator.",
    perMap: {},
  },
  bracket: {
    match: ["bracket"],
    general: "Toolboxes + electronic spawns. Hideout build.",
    perMap: {},
  },
  pgauge: {
    match: ["pressure gauge"],
    general: "Toolboxes + workbenches. Hideout Air Filtering Unit.",
    perMap: {},
  },
  isheet: {
    match: ["iron sheet", "sheet metal"],
    general: "Workbenches + construction site spawns. Hideout build.",
    perMap: {},
  },
  cordura: {
    match: ["cordura polyamide"],
    general: "Sewing kit + jacket spawns. Rare-ish hideout build item.",
    perMap: {},
  },
  lubefuel: {
    match: ["fuel conditioner", "lube"],
    general: "Gas station + garage + workbench spawns. Hideout fuel.",
    perMap: {},
  },
  syringe: {
    match: ["disposable syringe"],
    general: "Medbags + medical drawers. Drug crafting.",
    perMap: {},
  },
  alkali: {
    match: ["alkaline cleaner"],
    general: "Drawer + jacket spawns. Cheap - drug + hideout craft.",
    perMap: {},
  },
  fleece: {
    match: ["fleece fabric"],
    general: "Jacket pockets + sewing kit + drawer spawns. Hideout Stash + Rest Space.",
    perMap: {},
  },
  soap: {
    match: ["bar of soap", "soap"],
    general: "Sink + bathroom spawns + drawers. Hideout Lavatory.",
    perMap: {},
  },
  tpaper: {
    match: ["toilet paper"],
    general: "Bathrooms + drawers + jackets. Hideout Lavatory.",
    perMap: {},
  },
  bleach: {
    match: ["bleach"],
    general: "Sink + utility room spawns. Hideout Lavatory + crafts.",
    perMap: {},
  },
  sugar: {
    match: ["pack of sugar"],
    general: "Kitchen + grocery + jacket spawns. Hideout Booze Generator.",
    perMap: {},
  },
  hose: {
    match: ["corrugated hose"],
    general: "Toolboxes + garage spawns + workbenches. Hideout Workbench + Air Filter.",
    perMap: {},
  },
  kerosene: {
    match: ["kerosene"],
    general: "Gas station + garage spawns. Hideout fuel crafts.",
    perMap: {},
  },
  lightbulb: {
    match: ["working led", "led light"],
    general: "Drawers + electronic spawns. Hideout Illumination.",
    perMap: {},
  },
  crick: {
    match: ["cricket lighter", "golden zibbo", "zibbo"],
    general: "Pockets + jackets + safes. Cheap.",
    perMap: {},
  },
  tetriz: {
    match: ["tetriz"],
    general: "PC block desks + marked rooms. Rare drop, high cash value.",
    perMap: {
      customs: "Marked room (dorms 3F) · PC block spawns",
      reserve: "Marked rooms · PC blocks",
      "streets-of-tarkov": "Lexos PC block desks · Concordia",
    },
  },
  roler: {
    match: ["golden roler", "gold chain", "golden chain"],
    general: "Safe + jewelry spawns. High-value flea flip.",
    perMap: {
      customs: "Dorm safes · gas station safe · trailer jackets",
      shoreline: "Resort room safes · village safes · scav safes",
      "streets-of-tarkov": "Apartment jewelry spawns · Pinewood safes · Chess court",
    },
  },
  medal: {
    match: ["prokill medallion", "medallion"],
    general: "Safe + jewelry spawns. Common quest hand-in.",
    perMap: {},
  },
  gskull: {
    match: ["gold skull ring"],
    general: "Safe spawns only. High value.",
    perMap: {
      customs: "Dorm safes · gas station safe",
      shoreline: "Resort safes · village",
    },
  },
  antiqaxe: {
    match: ["antique axe"],
    general: "Specific spawns: weapon crates + safes. Often quest item.",
    perMap: {},
  },
  horse: {
    match: ["horse figurine"],
    general: "Jewelry + figurine spawns + safes.",
    perMap: {},
  },
  lion: {
    match: ["lion figurine"],
    general: "Jewelry + safe spawns.",
    perMap: {},
  },
  cat: {
    match: ["cat figurine"],
    general: "Jewelry + safe spawns.",
    perMap: {},
  },
  raven: {
    match: ["raven figurine"],
    general: "Jewelry + safe spawns.",
    perMap: {},
  },
  rooster: {
    match: ["rooster figurine"],
    general: "Jewelry + safe spawns.",
    perMap: {},
  },
  silvbadge: {
    match: ["silver badge"],
    general: "Scav jacket + safe spawns. Common Prapor barter currency.",
    perMap: {
      customs: "Big red building · scav jackets",
    },
  },
  cigar: {
    match: ["cigarette case", "apollo", "soyuz"],
    general: "Jacket + safe spawns. Quest hand-ins.",
    perMap: {},
  },
  wclock: {
    match: ["wall clock"],
    general: "Wall mount spawns in apartments + scav houses.",
    perMap: {},
  },
  intel: {
    match: ["intelligence folder"],
    general: "Office desks + safes. Intel Center fuel.",
    perMap: {
      woods: "UN camp military stashes · scav camp desk",
      "streets-of-tarkov": "Lexos offices · Chess · Concordia desks",
      interchange: "Kiba safes · Goshan safes · OLI offices",
      shoreline: "Resort safes · village · pier safes",
      customs: "Office desks + saferoom + dorms safes",
      "ground-zero": "Admin office safes · meeting room desks",
      reserve: "Pawn shop · barracks · marked rooms",
    },
  },
  sdiary: {
    match: ["slim diary"],
    general: "Desks + safes + jacket spawns. Quest hand-ins.",
    perMap: {},
  },
  diary: {
    match: ["diary"],
    general: "Desks + drawers. Often quest item.",
    perMap: {},
  },
  sshd: {
    match: ["secure flash drive"],
    general: "PC desks + drawers + safes. Quest item.",
    perMap: {},
  },
  ssd: {
    match: ["ssd drive"],
    general: "PC blocks + drawers + toolboxes.",
    perMap: {},
  },
  tushonka: {
    match: ["tushonka"],
    general: "Food spawns: kitchens, grocery, scav backpacks. Sugar + crafts hand-ins.",
    perMap: {},
  },
  beef: {
    match: ["can of beef"],
    general: "Food spawns + scav drops. Common Jaeger barter.",
    perMap: {},
  },
  mre: {
    match: ["mre lunch"],
    general: "Military crates + scav backpacks + food spawns.",
    perMap: {},
  },
  iskra: {
    match: ["iskra ration"],
    general: "Food spawns + scav drops. Cheap early-game flip.",
    perMap: {},
  },
  vodka: {
    match: ["russian standard vodka"],
    general: "Kitchens + bars + jacket spawns. Common quest item + barters.",
    perMap: {},
  },
  whisky: {
    match: ["whiskey"],
    general: "Bar/kitchen spawns + safes. Skier barters.",
    perMap: {},
  },
  moonshine: {
    match: ["moonshine"],
    general: "Booze Generator output. Used in nearly every mid-tier barter.",
    perMap: {},
  },
  wilston: {
    match: ["wilston cigarette"],
    general: "Cigarette spawns: pockets + drawers + kiosks.",
    perMap: {},
  },
  strike: {
    match: ["strike cigarette"],
    general: "Cigarette spawns: kiosks + drawers + safes.",
    perMap: {},
  },
  water: {
    match: ["bottle of water"],
    general: "Vending machines + kitchens + scav backpacks.",
    perMap: {},
  },
  choco: {
    match: ["bars-a chocolate", "chocolate bar"],
    general: "Kitchens + grocery + jacket spawns. Cheap quest staple.",
    perMap: {},
  },
  icase: {
    match: ["item case"],
    general: "Quest reward (Therapist) or 4× LedX barter. Not loot-spawned.",
    perMap: {},
  },
  wcase: {
    match: ["weapons case"],
    general: "Quest reward + barter. Not loot-spawned.",
    perMap: {},
  },
  mcase: {
    match: ["money case"],
    general: "Quest reward + barter at Therapist. Not loot-spawned.",
    perMap: {},
  },
  docs: {
    match: ["documents case"],
    general: "Therapist barter + quest reward.",
    perMap: {},
  },
  holod: {
    match: ["holodilnick"],
    general: "Quest reward (Mechanic). Not loot.",
    perMap: {},
  },
  dvl: {
    match: ["dvl-10"],
    general: "Sniper rifle spawn rooms. Disassemble for barter.",
    perMap: {
      reserve: "Sniper rifle spawns: barracks + armory",
      customs: "Sniper crate spawns near scav rifle racks",
    },
  },
  paracord: {
    match: ["paracord"],
    general: "Scav backpacks + tool spawns + jackets. Skier barters.",
    perMap: {},
  },
  gpowder: {
    match: ["gunpowder"],
    general: "Ammo crates + scav backpacks. Mechanic + Prapor barters.",
    perMap: {},
  },
  ofz: {
    match: ["ofz 30mm"],
    general: "Heavy shell crates. Prapor barter currency.",
    perMap: {
      reserve: "Tank shell crates · marked-key rooms",
    },
  },
  magbox: {
    match: ["magazine case"],
    general: "Quest reward + barter. Not loot.",
    perMap: {},
  },
  specsmoke: {
    match: ["flash drive", "secure flash"],
    general: "PC + drawer spawns. Quest item.",
    perMap: {},
  },
  apollo: {
    match: ["apollo soyuz"],
    general: "Cigarette spawns + safes. Quest hand-ins.",
    perMap: {},
  },
  gpu_old: {
    match: ["old graphics"],
    general: "PC blocks (rare variant). Barter currency.",
    perMap: {},
  },
};
