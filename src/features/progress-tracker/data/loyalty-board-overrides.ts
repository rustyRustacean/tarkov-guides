/**
 * Hand-curated loyalty-level / Essential-Tasks overrides, resolved from the
 * user's own in-game screenshots trader by trader.
 *
 * Why this exists at all: tarkov.dev's API cannot reliably answer either
 * question this file answers.
 *
 * 1. "Essential Tasks" (a distinct section BSG shows per trader, separate
 *    from LL1-4) has no distinguishing field anywhere in the API. Verified
 *    against Prapor: the real Essential section (The Punisher, The Good
 *    Times, Hell on Earth, Big Customer, Shipping Delay) has no field in
 *    common that separates it from an ordinary task, and only Big Customer
 *    happens to also be `kappaRequired`. It is NOT the same set as
 *    `kappaRequired` and must not be derived from it.
 * 2. A task's real loyalty tier (LL1-4) can only sometimes be read from the
 *    API: where `NormalizedTask.traderRequirements` has an explicit
 *    `{ requirementType: "level", traderId: <own trader> }` entry, it has
 *    matched every real screenshot checked so far. But roughly half of any
 *    trader's real tier list has no such gate at all (`minPlayerLevel: 0`,
 *    zero requirements) while still sitting at LL2-4 in-game, so guessing
 *    from `minPlayerLevel` is confirmed wrong (e.g. Prapor's "Best Job in
 *    the World" and "Intimidator" are real LL4 tasks with no API gate at
 *    all). See `resolveLoyaltyBoardEntry` in `selectors/loyalty-board.ts`
 *    for the full precedence rule this file feeds into.
 *
 * Entries are keyed by task id (stable; names can collide across tasks,
 * e.g. multiple "Neuanfang"/"Textile - Part 1" tasks exist), with the task
 * name as a trailing comment for human reviewability. Grows incrementally
 * as more trader screenshots arrive; tasks not listed here fall back to the
 * API signal or, failing that, an explicit "unconfirmed" bucket rather than
 * a guess.
 */
export interface LoyaltyBoardOverrideEntry {
  loyaltyLevel?: 1 | 2 | 3 | 4;
  /**
   * Only ever set here, by hand, from a real screenshot's "ESSENTIAL
   * TASKS" section. When true, this task's board placement is the
   * Essential row/lane regardless of any `loyaltyLevel` also present on
   * this entry (BSG's own UI treats them as mutually exclusive sections).
   */
  essential?: boolean;
}

export const LOYALTY_BOARD_OVERRIDES: Readonly<Record<string, LoyaltyBoardOverrideEntry>> = {
  // ─── Prapor (confirmed 2026-08-13 from user screenshot) ────────────────
  // 4 additional in-game "ESSENTIAL TASKS" ([KORD BREACH] Reverse Gear /
  // Uninvited Guests - Part 1 / Cast the Net / Know Your Enemy) are not yet
  // present in the tarkov.dev API at all (not even untranslated) and so
  // cannot be listed here until the API catches up.
  "5fd9fad9c1ce6b1a3b486d00": { loyaltyLevel: 1 }, // Search Mission
  "5936da9e86f7742d65037edf": { loyaltyLevel: 1 }, // Background Check
  "59c124d686f774189b3c843f": { loyaltyLevel: 1 }, // Oil Run
  "59674cd986f7744ab26e32f2": { loyaltyLevel: 1 }, // Shootout Picnic
  "5936d90786f7742b1420ba5b": { loyaltyLevel: 1 }, // Debut
  "63a5cf262964a7488f5243ce": { loyaltyLevel: 1 }, // Power of Persuasion
  "657315e1dccd301f1301416a": { loyaltyLevel: 1 }, // Luxurious Life
  "5967530a86f77462ba22226b": { loyaltyLevel: 1 }, // Bad Rep Evidence
  "675c3507a06634b5110e3c18": { loyaltyLevel: 1 }, // Belka and Strelka
  "657315df034d76585f032e01": { loyaltyLevel: 1 }, // Shooting Cans
  "5c0d190cd09282029f5390d8": { loyaltyLevel: 2 }, // Grenadier
  "64f5aac4b63b74469b6c14c2": { loyaltyLevel: 2 }, // Glory to CPSU
  "59675d6c86f7740a842fc482": { loyaltyLevel: 2 }, // Ice Cream Cones
  "5eda19f0edce541157209cee": { loyaltyLevel: 2 }, // Anesthesia
  "59675ea386f77414b32bded2": { loyaltyLevel: 2 }, // Postman Pat - Part 1
  "639136d68ba6894d155e77cf": { loyaltyLevel: 2 }, // Green Corridor
  "639136f086e646067c176a8b": { loyaltyLevel: 2 }, // Kings of the Rooftops
  "60e71b9bbd90872cb85440f3": { loyaltyLevel: 2 }, // Capturing Outposts
  "6573397ef3f8344c4575cd87": { loyaltyLevel: 2 }, // Properties All Around
  "64e7b9bffd30422ed03dad38": { loyaltyLevel: 2 }, // District Patrol
  "59674eb386f774539f14813a": { loyaltyLevel: 2 }, // Delivery From the Past
  "669fa399033a3ce9870338a8": { loyaltyLevel: 2 }, // Possessor
  "64f5deac39e45b527a7c4232": { loyaltyLevel: 2 }, // Job for a Patriot
  "6179ac7511973d018217d0b9": { loyaltyLevel: 3 }, // Easy Job
  "5c0bd94186f7747a727f09b2": { loyaltyLevel: 3 }, // The Tarkov Import
  "669fa3a40c828825de06d6a1": { loyaltyLevel: 3 }, // Easy-Breezy
  "60896bca6ee58f38c417d4f2": { loyaltyLevel: 3 }, // No Place for Renegades
  "626bd75c71bd851e971b82a5": { loyaltyLevel: 3 }, // Reconnaissance
  "60896b7bfa70fc097863b8f5": { loyaltyLevel: 3 }, // Documents
  "66ab970848ddbe9d4a0c49a8": { loyaltyLevel: 3 }, // Special Comms
  "6179b5b06e9dd54ac275e409": { loyaltyLevel: 3 }, // Our Own Land
  "5ede55112c95834b583f052a": { loyaltyLevel: 3 }, // The Bunker
  "675c1ff1a757ddd00404f0aa": { loyaltyLevel: 4 }, // Unique Experience
  "67b45467814ab0ffa000c7e7": { loyaltyLevel: 4 }, // The Art of Explosion
  "63a9ae24009ffc6a551631a5": { loyaltyLevel: 4 }, // Best Job in the World
  "60e71bb4e456d449cd47ca75": { loyaltyLevel: 4 }, // Intimidator
  "5d4bec3486f7743cac246665": { loyaltyLevel: 4 }, // Regulated Materials
  "6574e0dedc0d635f633a5805": { loyaltyLevel: 4 }, // Getting Some Air
  "59ca264786f77445a80ed044": { essential: true }, // The Punisher - Part 4
  "59c512ad86f7741f0d09de9b": { essential: true }, // The Punisher - Part 1
  "59c50a9e86f7745fef66f4ff": { essential: true }, // The Punisher - Part 2
  "59c50c8886f7745fed3193bf": { essential: true }, // The Punisher - Part 3
  "59ca29fb86f77445ab465c87": { essential: true }, // The Punisher - Part 5
  "666314b4d7f171c4c20226c3": { essential: true }, // The Good Times - Part 1
  "666314b0acf8442f8b0531a1": { essential: true }, // Hell on Earth - Part 1
  "666314b2a9290f9e0806cca3": { essential: true }, // Hell on Earth - Part 2
  "597a171586f77405ba6887d3": { essential: true }, // Big Customer
  "673f348dd3346c21670217e7": { essential: true }, // Shipping Delay - Part 1

  // ─── Therapist (confirmed 2026-08-14 from user screenshot) ─────────────
  // 1 additional in-game "ESSENTIAL TASKS" entry ([KORD BREACH] Unanswered
  // Calls) is not yet present in the tarkov.dev API at all and so cannot be
  // listed here until the API catches up.
  "657315ddab5a49b71f098853": { loyaltyLevel: 1 }, // First in Line
  "675c047fa46173572a0bd878": { loyaltyLevel: 1 }, // Shipment Tracking
  "5969f9e986f7741dde183a50": { loyaltyLevel: 1 }, // Pharmacist
  "59689fbd86f7740d137ebfc4": { loyaltyLevel: 1 }, // Operation Aquarius
  "5967733e86f774602332fc84": { loyaltyLevel: 1 }, // Shortage
  "6a5424ae135497b9df0c68be": { loyaltyLevel: 1 }, // Fall Ailment
  "596a0e1686f7741ddf17dbee": { loyaltyLevel: 1 }, // Supply Plans
  "675c03d1f7da9792a405549a": { loyaltyLevel: 1 }, // Abandoned Cargo
  "5968eb3186f7741dde183a4d": { loyaltyLevel: 1 }, // Blood in the Water
  "59c9392986f7742f6923add2": { loyaltyLevel: 2 }, // Aid Stations
  "669fa39ee749756c920d02c8": { loyaltyLevel: 2 }, // All Is Revealed
  "596a1e6c86f7741ddc2d3206": { loyaltyLevel: 2 }, // General Wares
  "639135e0fa894f0a866afde6": { loyaltyLevel: 2 }, // Urban Medicine
  "64f3176921045e77405d63b5": { loyaltyLevel: 2 }, // Paramedic
  "639135d89444fb141f4e6eea": { loyaltyLevel: 2 }, // Population Census
  "59689ee586f7740d1570bbd5": { loyaltyLevel: 2 }, // Sanitary Standards
  "67a09673972c11a3f507731d": { loyaltyLevel: 2 }, // The Tarkov Butcher
  "64f731ab83cfca080a361e42": { loyaltyLevel: 2 }, // Pets Won't Need It
  "60896e28e4a85c72ef3fa301": { loyaltyLevel: 3 }, // Disease History
  "596a218586f77420d232807c": { loyaltyLevel: 3 }, // Car Repair
  "626bd75b05f287031503c7f6": { loyaltyLevel: 3 }, // Drug Trafficking
  "5969f90786f77420d2328015": { loyaltyLevel: 3 }, // Charity
  "6179afd0bca27a099552e040": { loyaltyLevel: 3 }, // Lost Contact
  "5edab736cc183c769d778bc2": { loyaltyLevel: 3 }, // Colleagues
  "5edaba7c0c502106f869bc02": { loyaltyLevel: 3 }, // Tarkov-Style Diplomacy
  "6179ad56c760af5ad2053587": { loyaltyLevel: 3 }, // Seaside Vacation
  "66aba85403e0ee3101042877": { loyaltyLevel: 4 }, // Beneath The Streets
  "5c0d1c4cd0928202a02a6f5c": { loyaltyLevel: 4 }, // Decontamination Service
  "67a0972e77dd677f600804bd": { essential: true }, // This Tape Sucks
  "597a160786f77477531d39d2": { essential: true }, // Out of Curiosity
  "665eeca92f7aedcc900b0437": { essential: true }, // Thirsty - Secrets
  "665eeca45d86b6c8aa03c79d": { essential: true }, // Thirsty - Echo
  "5a68661a86f774500f48afb0": { essential: true }, // Health Care Privacy - Part 1
  "5a68663e86f774501078f78a": { essential: true }, // Health Care Privacy - Part 2
  "5a68665c86f774255929b4c7": { essential: true }, // Health Care Privacy - Part 3
  "5a68667486f7742607157d28": { essential: true }, // Health Care Privacy - Part 4
  "596760e186f7741e11214d58": { essential: true }, // Postman Pat - Part 2
  "669fa3910c828825de06d69f": { essential: true }, // A Healthy Alternative

  // ─── Fence (confirmed 2026-08-14 from user screenshot; only the
  // "ESSENTIAL TASKS" section was sent, no loyalty-level screenshot yet).
  // 3 additional in-game entries ([KORD BREACH] Forbidden Knowledge / Key
  // to Understanding / What's in the Bag?) are not yet present in the
  // tarkov.dev API at all and so cannot be listed here until it catches up.
  "66d9cbb67b491f9d5304f6e6": { essential: true }, // Is This a Reference?
  "66058ccf06ef1d50a60c1f48": { essential: true }, // Between Two Fires [PVP ZONE]
  "66058ccbc7f3584787181478": { essential: true }, // Against the Conscience - Part 1 [PVP ZONE]
  "5c51aac186f77432ea65c552": { essential: true }, // Collector

  // ─── Skier (confirmed 2026-08-14 from user screenshot) ─────────────────
  "5979eee086f774311955e614": { loyaltyLevel: 1 }, // Golden Swag
  "596b36c586f77450d6045ad2": { loyaltyLevel: 1 }, // Supplier
  "596b43fb86f77457ca186186": { loyaltyLevel: 1 }, // The Extortionist
  "675c3582f6ddc329a90f9c6d": { loyaltyLevel: 1 }, // Private Club
  "658027799634223183395339": { loyaltyLevel: 1 }, // No Swiping
  "5b47926a86f7747ccc057c15": { loyaltyLevel: 1 }, // Informed Means Armed
  "5979ed3886f77431307dc512": { loyaltyLevel: 1 }, // What's on the Flash Drive?
  "657315e270bb0b8dba00cc48": { loyaltyLevel: 1 }, // Burning Rubber
  "5979f8bb86f7743ec214c7a6": { loyaltyLevel: 1 }, // Polikhim Hobo
  "5b4795fb86f7745876267770": { loyaltyLevel: 2 }, // Chumming
  "5b478eca86f7744642012254": { loyaltyLevel: 2 }, // Vitamins
  "5c1234c286f77406fa13baeb": { loyaltyLevel: 2 }, // Setup
  "639dbaf17c898a131e1cffff": { loyaltyLevel: 2 }, // Debtor
  "64f6aafd67e11a7c6206e0d0": { loyaltyLevel: 2 }, // The Secret Recipe
  "64f5e20652fc01298e2c61e3": { loyaltyLevel: 2 }, // Beyond the Red Meat
  "669fa39c64ea11e84c0642a6": { loyaltyLevel: 2 }, // The Walls Have Eyes
  "669fa395c4c5c04798002497": { loyaltyLevel: 2 }, // Exit Here
  "5a27c99a86f7747d2c6bdd8e": { loyaltyLevel: 2 }, // Friend From the West
  "596b455186f77457cb50eccb": { loyaltyLevel: 2 }, // Stirrup
  "6179b4f16e9dd54ac275e407": { loyaltyLevel: 3 }, // Missing Cargo
  "6089743983426423753cd58a": { loyaltyLevel: 3 }, // Safe Corridor
  "5edabd13218d181e29451442": { loyaltyLevel: 3 }, // Rigged Game
  "6572e876dc0d635f633a5714": { loyaltyLevel: 3 }, // Pyramid Scheme
  "626bd75d5bef5d7d590bd415": { loyaltyLevel: 3 }, // Top Secret
  "60896888e4a85c72ef3fa300": { loyaltyLevel: 3 }, // Classified Technologies
  "5c0d0f1886f77457b8210226": { loyaltyLevel: 3 }, // From Hand to Hand
  "6193850f60b34236ee0483de": { loyaltyLevel: 3 }, // Long Road
  "5c0bc91486f7746ab41857a2": { loyaltyLevel: 4 }, // Silent Caliber
  "5c0bbaa886f7746941031d82": { loyaltyLevel: 4 }, // Bullshit
  "67a097379f2068e74603c6ac": { essential: true }, // Indisputable Authority
  "68400926706e0a55e90b0007": { essential: true }, // Fair Price - Part 1
  "597a0f5686f774273b74f676": { essential: true }, // Chemical - Part 4
  "5979f9ba86f7740f6c3fe9f2": { essential: true }, // Chemical - Part 1
  "597a0b2986f77426d66c0633": { essential: true }, // Chemical - Part 2
  "597a0e5786f77426d66c0636": { essential: true }, // Chemical - Part 3
  "67af4c169d95ad16e004fd86": { essential: true }, // Safety Guarantee
  "665eec4a4dfc83b0ed0a9dca": { essential: true }, // Thirsty - Delivery
  "665eec1f5e47a79f8605565a": { essential: true }, // Thirsty - Breadwinner
  "671a59e43d73dac1360765cc": { essential: true }, // Dangerous Props
  "671a49f77d49aea42c029b5f": { essential: true }, // Irresistible
  "66058cb22cee99303f1ba067": { essential: true }, // Easy Money - Part 1 [PVP ZONE]

  // ─── Peacekeeper (confirmed 2026-08-14 from user screenshot) ───────────
  "66aa58245ab22944110db6e9": { loyaltyLevel: 1 }, // New Paths
  "675c1d6d59b0575973008fc7": { loyaltyLevel: 1 }, // Seizing the Initiative
  "5a27bafb86f7741c73584017": { loyaltyLevel: 1 }, // Chemical Experiments
  "5a0449d586f77474e66227b7": { loyaltyLevel: 1 }, // Master Key
  "6a5c1578f2689567c30eb0f3": { loyaltyLevel: 1 }, // Hiking
  "669fa38fad7f1eac2607ed46": { loyaltyLevel: 1 }, // One Less Loose End
  "5a0327ba86f77456b9154236": { loyaltyLevel: 1 }, // Fuel Shortage
  "5b4794cb86f774598100d5d4": { loyaltyLevel: 1 }, // Metal Birds
  "5a27b75b86f7742e97191958": { loyaltyLevel: 2 }, // Fishing Gear
  "5a27b9de86f77464e5044585": { loyaltyLevel: 2 }, // The Cult
  "5a03153686f77442d90e2171": { loyaltyLevel: 2 }, // One-Way Ticket
  "5a27b80086f774429a5d7e20": { loyaltyLevel: 2 }, // Eagle Eye
  "6a5ccda873f06065630d61b0": { loyaltyLevel: 2 }, // Secret Message
  "5a03296886f774569778596a": { loyaltyLevel: 2 }, // I Need More Power
  "5a27ba1c86f77461ea5a3c56": { loyaltyLevel: 2 }, // Weapons Circulation
  "639135f286e646067c176a87": { loyaltyLevel: 2 }, // Revision - Streets of Tarkov
  "639135534b15ca31f76bc317": { loyaltyLevel: 2 }, // Your Car Needs a Service
  "5a27b87686f77460de0252a8": { loyaltyLevel: 2 }, // Humanitarian Supplies
  "5a27b7d686f77460d847e6a6": { loyaltyLevel: 2 }, // Scrap Metal
  "6a5cd2178fd7c2b201032f3f": { loyaltyLevel: 3 }, // Demonstration Model
  "5a27bb3d86f77411ea361a21": { loyaltyLevel: 3 }, // Tracker
  "6179b4d1bca27a099552e04e": { loyaltyLevel: 3 }, // Revision - Lighthouse
  "5a27bb1e86f7741f27621b7e": { loyaltyLevel: 3 }, // Cargo X
  "60e71c9ad54b755a3b53eb66": { loyaltyLevel: 3 }, // The Cleaner
  "61958c366726521dd96828ec": { loyaltyLevel: 3 }, // Gifts from Tarkov
  "6086c852c945025d41566124": { loyaltyLevel: 3 }, // Revision - Reserve
  "6179aff8f57fb279792c60a1": { loyaltyLevel: 3 }, // Overpopulation
  "5c0d4c12d09282029f539173": { loyaltyLevel: 4 }, // Peacekeeping Mission
  "60e71ccb5688f6424c7bfec4": { loyaltyLevel: 4 }, // Trophies
  "5edac020218d181e29451446": { loyaltyLevel: 4 }, // Samples
  "5edac63b930f5454f51e128b": { loyaltyLevel: 4 }, // TerraGroup Employee
  "63a9b229813bba58a50c9ee5": { loyaltyLevel: 4 }, // Worst Job in the World
  "67a09724972c11a3f5077324": { essential: true }, // Confidential Info
  "5a27bc8586f7741b543d8ea4": { essential: true }, // Wet Job - Part 6
  "5a27bb8386f7741c770d2d0a": { essential: true }, // Wet Job - Part 1
  "5a27bbf886f774333a418eeb": { essential: true }, // Wet Job - Part 2
  "5a27bc1586f7741f6d40fa2f": { essential: true }, // Wet Job - Part 3
  "5a27bc3686f7741c73584026": { essential: true }, // Wet Job - Part 4
  "5a27bc6986f7741c7358402b": { essential: true }, // Wet Job - Part 5

  // ─── Mechanic (confirmed 2026-08-14 from user screenshot) ──────────────
  // 1 in-game LL2 entry ("Corporate Perks") is not yet present in the
  // tarkov.dev API at all and so cannot be listed here until it catches up.
  "5ac3475486f7741d6224abd3": { loyaltyLevel: 1 }, // Bad Habit
  "5ac2426c86f774138762edfe": { loyaltyLevel: 1 }, // Gunsmith - AKS-74U
  "5ac3462b86f7741d6118b983": { loyaltyLevel: 1 }, // Farming
  "6578ec473dbd035d04531a8d": { loyaltyLevel: 1 }, // Steady Signal
  "657315e4a6af4ab4b50f3459": { loyaltyLevel: 1 }, // Saving the Mole
  "675c1570526ff496850895d9": { loyaltyLevel: 1 }, // Passion for Ergonomics
  "5ac23c6186f7741247042bad": { loyaltyLevel: 1 }, // Gunsmith - MP-133
  "60e71d6d7fcf9c556f325055": { loyaltyLevel: 1 }, // The Courier
  "5ac2428686f77412450b42bf": { loyaltyLevel: 1 }, // Gunsmith - HK MP5
  "5ac345dc86f774288030817f": { loyaltyLevel: 2 }, // Playing the Market
  "639136fa9444fb141f4e6eee": { loyaltyLevel: 2 }, // Watching You
  "639872f9decada40426d3447": { loyaltyLevel: 2 }, // Gunsmith - OP-SKS
  "5ac3477486f7741d651d6885": { loyaltyLevel: 2 }, // Scout
  "5ae3267986f7742a413592fe": { loyaltyLevel: 2 }, // Gunsmith - Model 870
  "66aa74571e5e199ecd094f18": { loyaltyLevel: 2 }, // Secrets of Polikhim
  "639135e8c115f907b14700aa": { loyaltyLevel: 2 }, // Surveillance
  "5f04886a3937dc337a6b8238": { loyaltyLevel: 2 }, // Chemistry Closet
  "669fa39b91b0a8c9680fc467": { loyaltyLevel: 2 }, // Black Swan
  "5ac3467986f7741d6224abc2": { loyaltyLevel: 2 }, // Ill-Wisher
  "5ac346a886f7744e1b083d67": { loyaltyLevel: 2 }, // Rat Hunting
  "6179b3bdc7560e13d23eeb8d": { loyaltyLevel: 3 }, // Corporate Secrets
  "5ae327c886f7745c7b3f2f3f": { loyaltyLevel: 3 }, // Gunsmith - AK-105
  "5ac3464c86f7741d651d6877": { loyaltyLevel: 3 }, // Semiconductor Crisis
  "6179b3a12153c15e937d52bc": { loyaltyLevel: 3 }, // Energy Crisis
  "5c139eb686f7747878361a6f": { loyaltyLevel: 3 }, // Import
  "6089732b59b92115597ad789": { loyaltyLevel: 3 }, // Surplus Goods
  "64ee9df4496db64f9b7a4432": { loyaltyLevel: 3 }, // The Door
  "6089736efa70fc097863b8f6": { loyaltyLevel: 3 }, // Back Door
  "5c1128e386f7746565181106": { loyaltyLevel: 3 }, // Fertilizers
  "5ae3277186f7745973054106": { loyaltyLevel: 3 }, // Gunsmith - AKS-74N
  "5ae3270f86f77445ba41d4dd": { loyaltyLevel: 3 }, // Gunsmith - AKM
  "5ae3280386f7742a41359364": { loyaltyLevel: 3 }, // Gunsmith - AS VAL
  "5c0be13186f7746f016734aa": { loyaltyLevel: 4 }, // Psycho Sniper
  "6942b44f891369fc790e385a": { loyaltyLevel: 4 }, // Setting Priorities
  "60e71d23c1bfa3050473b8e6": { loyaltyLevel: 4 }, // Calibration
  "5c0bde0986f77479cf22c2f8": { loyaltyLevel: 4 }, // Shooter Born in Heaven
  "68db9c7557bc51a8c804c14b": { loyaltyLevel: 4 }, // Goals and Means
  "5b47825886f77468074618d3": { essential: true }, // Gunsmith Master - Part 9
  "639872fe8871e1272b10ccf6": { essential: true }, // Gunsmith Master - Part 1
  "5ac244c486f77413e12cf945": { essential: true }, // Gunsmith Master - Part 2
  "5ac242ab86f77412464f68b4": { essential: true }, // Gunsmith Master - Part 3
  "5b47749f86f7746c5d6a5fd4": { essential: true }, // Gunsmith Master - Part 4
  "5b477b6f86f7747290681823": { essential: true }, // Gunsmith Master - Part 5
  "639873003693c63d86328f25": { essential: true }, // Gunsmith Master - Part 6
  "5b477f7686f7744d1b23c4d2": { essential: true }, // Gunsmith Master - Part 7
  "63987301e11ec11ff5504036": { essential: true }, // Gunsmith Master - Part 8
  "64f83bb69878a0569d6ecfbe": { essential: true }, // Gunsmith Master - Part 10
  "67a0970f05d1611ed90be75d": { essential: true }, // Hypotheses Testing
  "67a09636b8725511260bc421": { essential: true }, // Shady Contractor
  "67a0964e972c11a3f507731b": { essential: true }, // Needle in a Haystack
  "67a096577e86e067eb045733": { essential: true }, // Hidden Layer
  "67a0970744893b9f3f0d9b68": { essential: true }, // Offensive Reconnaissance
  "684009026ceedc792c09b2a7": { essential: true }, // Hobby Club
  "63913715f8e5dd32bf4e3aaa": { essential: true }, // Broadcast - Part 2
  "626bd75e47ea7f506e5493c5": { essential: true }, // Broadcast - Part 1
  "6752f6d83038f7df520c83e8": { essential: true }, // A Helping Hand
  "5d2495a886f77425cd51e403": { essential: true }, // Introduction

  // ─── Ragman (confirmed 2026-08-14 from user screenshot) ────────────────
  // 1 additional in-game "ESSENTIAL TASKS" entry ([KORD BREACH] Riding the
  // Wave) is not yet present in the tarkov.dev API at all and so cannot be
  // listed here until it catches up. Drip-Out - Part 1/2 and Textile - Part
  // 1 each have both a BEAR and a USEC task id for the same in-game entry
  // (see this file's header comment on name collisions); both ids are
  // listed so either faction resolves correctly.
  "5ae449c386f7744bde357696": { loyaltyLevel: 1 }, // Pathfinder
  "5ae448f286f77448d73c0131": { loyaltyLevel: 1 }, // Fuel Crisis
  "5ae448bf86f7744d733e55ee": { loyaltyLevel: 1 }, // Make ULTRA Great Again
  "5ae4493486f7744efa289417": { loyaltyLevel: 1 }, // Inventory Files
  "5ae4490786f7744ca822adcc": { loyaltyLevel: 1 }, // Dressed to Kill
  "60e71dc0a94be721b065bbfc": { loyaltyLevel: 1 }, // Long Line
  "5c10f94386f774227172c572": { loyaltyLevel: 1 }, // Small Things, Big Help
  "5ae449b386f77446d8741719": { loyaltyLevel: 1 }, // Gratitude
  "5ae448e586f7744dcf0c2a67": { loyaltyLevel: 2 }, // Big Sale
  "65734c186dc1e402c80dc19e": { loyaltyLevel: 2 }, // Dandies
  "639135a7e705511c8a4a1b78": { loyaltyLevel: 2 }, // Ballet Lover
  "5b478b1886f7744d1b23c57d": { loyaltyLevel: 2 }, // Hot Delivery
  "638fcd23dc65553116701d33": { loyaltyLevel: 2 }, // Audit
  "5ae4498786f7744bde357695": { loyaltyLevel: 2 }, // The Key to Success
  "675c085d59b0575973005f52": { loyaltyLevel: 2 }, // Break the Deal
  "5ae449d986f774453a54a7e1": { loyaltyLevel: 2 }, // Supervisor
  "65802b627b44fa5e14638899": { loyaltyLevel: 2 }, // Nothing Fishy About This
  "5b478d0f86f7744d190d91b5": { loyaltyLevel: 2 }, // Minibus
  "5b47891f86f7744d1b23c571": { loyaltyLevel: 3 }, // Living High is Not a Crime
  "639135bbc115f907b14700a6": { loyaltyLevel: 3 }, // Audiophile
  "608974af4b05530f55550c21": { loyaltyLevel: 3 }, // Reserve Expert
  "66aa61663aa37705c5024277": { loyaltyLevel: 3 }, // Know Your Place!
  "5c112d7e86f7740d6f647486": { loyaltyLevel: 3 }, // Scavenger
  "608974d01a66564e74191fc0": { loyaltyLevel: 3 }, // A Fuel Matter
  "60e71dc67fcf9c556f325056": { loyaltyLevel: 3 }, // Booze
  "5c1141f386f77430ff393792": { loyaltyLevel: 4 }, // Antique Enthusiast
  "67d03be712fb5f8fd2096332": { essential: true }, // Vacate the Premises
  "67a0967c003a9986cb0f5ac1": { essential: true }, // Sensory Analysis - Part 1
  "5ae4496986f774459e77beb6": { essential: true }, // Sew it Good - Part 4
  "5ae4495086f77443c122bc40": { essential: true }, // Sew it Good - Part 1
  "5ae4497b86f7744cf402ed00": { essential: true }, // Sew it Good - Part 2
  "5ae4495c86f7744e87761355": { essential: true }, // Sew it Good - Part 3
  "66151401efb0539ae10875ae": { essential: true }, // Drip-Out - Part 1 (USEC)
  "6613f3007f6666d56807c929": { essential: true }, // Drip-Out - Part 1 (BEAR)
  "6613f307fca4f2f386029409": { essential: true }, // Drip-Out - Part 2 (BEAR)
  "6615141bfda04449120269a7": { essential: true }, // Drip-Out - Part 2 (USEC)
  "5e381b0286f77420e3417a74": { essential: true }, // Textile - Part 1 (BEAR)
  "5e383a6386f77465910ce1f3": { essential: true }, // Textile - Part 1 (USEC)
  "6663149f1d3ec95634095e75": { essential: true }, // Circulate
  "6663149cfd5ca9577902e037": { essential: true }, // The Invisible Hand

  // ─── Jaeger (confirmed 2026-08-14 from user screenshot) ────────────────
  // "The Huntsman Path - Administrator" and "The Tarkov Shooter - Part 5"
  // each resolve to two task ids in the API with identical name/level/
  // requirements (an apparent API-side duplicate, not a faction split);
  // both ids are listed for each so the override applies either way.
  "66b38c7bf85b8bf7250f9cb6": { loyaltyLevel: 1 }, // Rough Tarkov
  "5d25e43786f7740a212217fa": { loyaltyLevel: 1 }, // The Huntsman Path - Justice
  "60e729cf5698ee7b05057439": { loyaltyLevel: 1 }, // Swift
  "5d24b81486f77439c92d6ba8": { loyaltyLevel: 1 }, // Acquaintance
  "675c1cf4a757ddd00404f0a3": { loyaltyLevel: 1 }, // Work Smarter
  "5d25e44386f77409453bce7b": { loyaltyLevel: 1 }, // The Huntsman Path - Angry Watchman
  "5d25e46e86f77409453bce7c": { loyaltyLevel: 1 }, // First Aid
  "5d25e2ee86f77443e35162ea": { loyaltyLevel: 1 }, // The Huntsman Path - Woods Keeper
  "600302d73b897b11364cd161": { loyaltyLevel: 1 }, // All This Filth...
  "64e7b971f9d6fa49d6769b44": { loyaltyLevel: 2 }, // The Huntsman Path - Big Game
  "66b38e144f2ab7cc530c3fe7": { loyaltyLevel: 2 }, // Every Hunter Knows This
  "6578eb36e5020875d64645cd": { loyaltyLevel: 2 }, // The Huntsman Path - Crooked Cop
  "639136e84ed9512be67647db": { loyaltyLevel: 2 }, // Cease Fire!
  "5d25e4ad86f77443e625e387": { loyaltyLevel: 2 }, // Nostalgia
  "669fa3979b0ce3feae01a130": { loyaltyLevel: 2 }, // Claustrophobia
  "5d25e48186f77443e625e386": { loyaltyLevel: 2 }, // Courtesy Visit
  "5d25e2e286f77444001e2e48": { loyaltyLevel: 2 }, // The Huntsman Path - Sellout
  "669fa3a08b4a64b332041ff7": { loyaltyLevel: 2 }, // Dragnet
  "63a88045abf76d719f42d715": { loyaltyLevel: 2 }, // The Delicious Sausage
  "60c0c018f7afb4354815096a": { loyaltyLevel: 2 }, // The Huntsman Path - Factory Chief
  "5d25e4d586f77443e625e388": { loyaltyLevel: 3 }, // Reserve
  "61904daa7d0d857927447b9c": { loyaltyLevel: 3 }, // The Hermit
  "608a768d82e40b3c727fd17d": { loyaltyLevel: 3 }, // Pest Control
  "5d25e2b486f77409de05bba0": { loyaltyLevel: 3 }, // The Huntsman Path - Secured Perimeter
  "639136df4b15ca31f76bc31f": { loyaltyLevel: 3 }, // The Huntsman Path - Administrator
  "6a45208043b8d7604d00b8d5": { loyaltyLevel: 3 }, // The Huntsman Path - Administrator (dup id)
  "66ab9da7eb102b9bcd08591c": { loyaltyLevel: 3 }, // Forester's Duty
  "5d25e4b786f77408251c4bfc": { loyaltyLevel: 3 }, // Fishing Place
  "5d25e45e86f77408251c4bfa": { loyaltyLevel: 3 }, // The Huntsman Path - Liberation
  "6179ad0a6e9dd54ac275e3f2": { loyaltyLevel: 3 }, // The Huntsman Path - Outcasts
  "5d25e2cc86f77443e47ae019": { loyaltyLevel: 3 }, // The Huntsman Path - Forest Cleaning
  "5d25e44f86f77443e625e385": { loyaltyLevel: 3 }, // The Huntsman Path - Eraser
  "626bdcc3a371ee3a7a3514c5": { loyaltyLevel: 4 }, // Stray Dogs
  "63a9b36cc31b00242d28a99f": { loyaltyLevel: 4 }, // Slaughterhouse
  "6a4532e48e82d8ffea0c3eae": { loyaltyLevel: 4 }, // The Huntsman Path - Control
  "6391372c8ba6894d155e77d7": { essential: true }, // Broadcast - Part 4
  "63a511ea30d85e10e375b045": { essential: true }, // Broadcast - Part 3
  "5bc4856986f77454c317bea7": { essential: true }, // The Tarkov Shooter - Part 6
  "5bc4776586f774512d07cf05": { essential: true }, // The Tarkov Shooter - Part 1
  "5bc479e586f7747f376c7da3": { essential: true }, // The Tarkov Shooter - Part 2
  "5bc47dbf86f7741ee74e93b9": { essential: true }, // The Tarkov Shooter - Part 3
  "5bc480a686f7741af0342e29": { essential: true }, // The Tarkov Shooter - Part 4
  "5bc4826c86f774106d22d88b": { essential: true }, // The Tarkov Shooter - Part 5
  "5bc4836986f7740c0152911c": { essential: true }, // The Tarkov Shooter - Part 5 (dup id)
  "5bc4893c86f774626f5ebf3e": { essential: true }, // The Tarkov Shooter - Part 7
  "5d25aed386f77442734d25d2": { essential: true }, // The Survivalist Path - Unprotected but Dangerous
  "5d25b6be86f77444001e1b89": { essential: true }, // The Survivalist Path - Thrifty
  "5d25bfd086f77442734d3007": { essential: true }, // The Survivalist Path - Zhivchik
  "5d25c81b86f77443e625dd71": { essential: true }, // The Survivalist Path - Wounded Beast
  "665eeacf5d86b6c8aa03c79b": { essential: true }, // Thirsty - Hounds

  // ─── Ref (confirmed 2026-08-14; only 8 of these were visible in the
  // user's screenshot, but the user confirmed Ref has no loyalty-level
  // tiers in-game and asked to mark all of Ref's tasks essential) ─────────
  "66058ccde8e4f17985230807": { essential: true }, // Against the Conscience - Part 2 [PVP ZONE]
  "697877e0c639962b2e0cf24f": { essential: true }, // Arena Business [PVP ZONE]
  "66058cb7c7f3584787181476": { essential: true }, // Balancing - Part 1 [PVP ZONE]
  "66058cb9e8e4f17985230805": { essential: true }, // Balancing - Part 2 [PVP ZONE]
  "66058cbd9f59e625462acc8e": { essential: true }, // Create a Distraction - Part 1 [PVP ZONE]
  "66058cbf2f19c31a5a1337ec": { essential: true }, // Create a Distraction - Part 2 [PVP ZONE]
  "66058cd19f59e625462acc90": { essential: true }, // Decisions, Decisions [PVP ZONE]
  "66058cb5ae4719735349b9e8": { essential: true }, // Easy Money - Part 2 [PVP ZONE]
  "697895b6c639962b2e0cf268": { essential: true }, // Hold the Lead [PVP ZONE]
  "67e993f5ed537409f009da75": { essential: true }, // Postponed Reward [PVP ZONE]
  "69788c2bac719606e40b4e77": { essential: true }, // Professional Fitness - Part 1 [PVP ZONE]
  "69788db3878a4385d10c0718": { essential: true }, // Professional Fitness - Part 2 [PVP ZONE]
  "675c15fbf7da9792a4059871": { essential: true }, // Provide Viewership
  "66058cbb06ef1d50a60c1f46": { essential: true }, // Surprise [PVP ZONE]
  "66058cc1da30b620a34e6e86": { essential: true }, // To Great Heights! - Part 1 [PVP ZONE]
  "66058cc208308761cf390993": { essential: true }, // To Great Heights! - Part 2 [PVP ZONE]
  "66058cc5bb83da7ba474aba9": { essential: true }, // To Great Heights! - Part 3 [PVP ZONE]
  "66058cc72cee99303f1ba069": { essential: true }, // To Great Heights! - Part 4 [PVP ZONE]
  "66058cc9ae4719735349b9ea": { essential: true }, // To Great Heights! - Part 5 [PVP ZONE]
  "69789418b2187365e70bb947": { essential: true }, // To Great Heights! - Part 6 [PVP ZONE]
};
