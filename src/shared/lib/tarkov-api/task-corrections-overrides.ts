/**
 * Hand-verified corrections to a task's `minPlayerLevel` and/or
 * `taskRequirements` (prerequisites), sourced from the Escape from Tarkov
 * wiki (each `NormalizedTask.wikiLink`), for cases where tarkov.dev's API
 * value has been checked and confirmed wrong or stale.
 *
 * This is intentionally a small, slow-growing list, not a full re-derivation
 * of either field: the API is right for the overwhelming majority of tasks,
 * so only entries with a confirmed mismatch belong here. A task absent from
 * this file has NOT been verified against the wiki yet; see
 * `TASK_VERIFICATION_PROGRESS.json` (repo root, not shipped) for the
 * per-task sweep status.
 *
 * Applied in `normalizeTask` (`normalize-task.ts`): when present, an entry's
 * `minPlayerLevel` and/or `taskRequirements` fully replace the API's own
 * value for that field (never merged), since a wiki correction found for one
 * field doesn't imply anything about the other.
 *
 * Entries are keyed by task id, with the task name as a trailing comment for
 * human reviewability (same convention as `loyalty-board-overrides.ts`).
 */
export interface TaskCorrectionOverride {
  minPlayerLevel?: number;
  taskRequirements?: readonly { taskId: string; status: readonly string[] }[];
}

export const TASK_CORRECTIONS_OVERRIDES: Readonly<Record<string, TaskCorrectionOverride>> = {
  // ─── Prerequisite-chain gaps confirmed 2026-09-07 ───────────────────────
  // tarkov.dev's `taskRequirements` graph has a confirmed, isolated gap: for
  // the 7 "classic" traders (Prapor, Therapist, Skier, Peacekeeper, Mechanic,
  // Ragman, Jaeger) roughly half of each questline's tasks carry an EMPTY
  // `taskRequirements` array despite the wiki's infobox `previous` field
  // naming a real predecessor quest. The newer traders (BTR Driver,
  // Lightkeeper, Ref) show no such gap at all, which is why this reads as an
  // API-side historical parsing gap for the long-standing classic chains,
  // not a general "wiki beats API" situation.
  //
  // Every entry below is a case where the wiki names exactly one prerequisite
  // path (no "or" alternative, since this data model can only express AND,
  // never OR) and the API's own `taskRequirements` for that task is entirely
  // empty; each wiki-named quest name was resolved to its real task id via
  // `master-task-list.json` (same-trader preferred on a name collision, per
  // the duplicate-name pattern already documented in
  // `loyalty-board-overrides.ts`). Chain plausibility spot-checked against
  // known real questlines (e.g. Prapor's Punisher chain gating Best Job in
  // the World / Intimidator / Escort / Capturing Outposts, matching the
  // loyalty overrides' own LL4 comments). ~84 further mismatches were left
  // out entirely (OR-alternatives the schema can't express, ambiguous name
  // resolution, or the API already had a different requirement) and need
  // individual manual review rather than a mechanical fix.
  //
  // Deliberately NOT touched: `minPlayerLevel`. The same trader-chain pattern
  // also shows up there (wiki's "Must be level N to start this quest" is
  // usually HIGHER than the API's value, sometimes 0), but this is much more
  // likely the wiki being stale after a real BSG level-requirement rebalance
  // than the API being wrong: `minPlayerLevel` is machine-extracted from the
  // game's own files, and wrongly raising it would hard-block real users from
  // a quest the live game actually allows. See `TASK_VERIFICATION_PROGRESS.json`
  // for the full per-task sweep status, including the level-mismatch list
  // left for the user's review rather than auto-applied.

  // --- Jaeger ---
  "5d24b81486f77439c92d6ba8": {
    taskRequirements: [{ taskId: "5d2495a886f77425cd51e403", status: ["complete"] }],
  }, // Acquaintance <- Introduction
  "600302d73b897b11364cd161": {
    taskRequirements: [{ taskId: "5d25e2ee86f77443e35162ea", status: ["complete"] }],
  }, // All This Filth... <- The Huntsman Path - Woods Keeper
  "639136e84ed9512be67647db": {
    taskRequirements: [{ taskId: "63a88045abf76d719f42d715", status: ["complete"] }],
  }, // Cease Fire! <- The Delicious Sausage
  "669fa3979b0ce3feae01a130": {
    taskRequirements: [{ taskId: "5d25e2cc86f77443e47ae019", status: ["complete"] }],
  }, // Claustrophobia <- The Huntsman Path - Forest Cleaning
  "5d25e48186f77443e625e386": {
    taskRequirements: [{ taskId: "5d25cf2686f77443e75488d4", status: ["complete"] }],
  }, // Courtesy Visit <- The Survivalist Path - Tough Guy
  "66b38e144f2ab7cc530c3fe7": {
    taskRequirements: [{ taskId: "66b38c7bf85b8bf7250f9cb6", status: ["complete"] }],
  }, // Every Hunter Knows This <- Rough Tarkov
  "5d25e46e86f77409453bce7c": {
    taskRequirements: [{ taskId: "5d24b81486f77439c92d6ba8", status: ["complete"] }],
  }, // First Aid <- Acquaintance
  "5d25e4b786f77408251c4bfc": {
    taskRequirements: [{ taskId: "5d25e4ad86f77443e625e387", status: ["complete"] }],
  }, // Fishing Place <- Nostalgia
  "66ab9da7eb102b9bcd08591c": {
    taskRequirements: [{ taskId: "5d25e4ad86f77443e625e387", status: ["complete"] }],
  }, // Forester's Duty <- Nostalgia
  "5d25e4ca86f77409dd5cdf2c": {
    taskRequirements: [{ taskId: "5d25e2ee86f77443e35162ea", status: ["complete"] }],
  }, // Hunting Trip <- The Huntsman Path - Woods Keeper
  "5d25e4ad86f77443e625e387": {
    taskRequirements: [{ taskId: "5d25e48186f77443e625e386", status: ["complete"] }],
  }, // Nostalgia <- Courtesy Visit
  "5d25e4d586f77443e625e388": {
    taskRequirements: [{ taskId: "63a88045abf76d719f42d715", status: ["complete"] }],
  }, // Reserve <- The Delicious Sausage
  "66b38c7bf85b8bf7250f9cb6": {
    taskRequirements: [{ taskId: "5d24b81486f77439c92d6ba8", status: ["complete"] }],
  }, // Rough Tarkov <- Acquaintance
  "626bdcc3a371ee3a7a3514c5": {
    taskRequirements: [
      { taskId: "5d25e2c386f77443e7549029", status: ["complete"] },
      { taskId: "5d25e2e286f77444001e2e48", status: ["complete"] },
      { taskId: "5d25e2ee86f77443e35162ea", status: ["complete"] },
    ],
  }, // Stray Dogs <- The Huntsman Path - Trophy + The Huntsman Path - Sellout + The Huntsman Path - Woods Keeper
  "63a88045abf76d719f42d715": {
    taskRequirements: [{ taskId: "5d25b6be86f77444001e1b89", status: ["complete"] }],
  }, // The Delicious Sausage <- The Survivalist Path - Thrifty
  "5d25e44386f77409453bce7b": {
    taskRequirements: [{ taskId: "5d25e2cc86f77443e47ae019", status: ["complete"] }],
  }, // The Huntsman Path - Angry Watchman <- The Huntsman Path - Forest Cleaning
  "64e7b971f9d6fa49d6769b44": {
    taskRequirements: [
      { taskId: "5d25e2cc86f77443e47ae019", status: ["complete"] },
      { taskId: "639135e0fa894f0a866afde6", status: ["complete"] },
    ],
  }, // The Huntsman Path - Big Game <- The Huntsman Path - Forest Cleaning + Urban Medicine
  "60c0c018f7afb4354815096a": {
    taskRequirements: [
      { taskId: "5ac3477486f7741d651d6885", status: ["complete"] },
      { taskId: "5d25e2cc86f77443e47ae019", status: ["complete"] },
    ],
  }, // The Huntsman Path - Factory Chief <- Scout + The Huntsman Path - Forest Cleaning
  "5d25e43786f7740a212217fa": {
    taskRequirements: [{ taskId: "5d25e2b486f77409de05bba0", status: ["complete"] }],
  }, // The Huntsman Path - Justice <- The Huntsman Path - Secured Perimeter
  "6179ad0a6e9dd54ac275e3f2": {
    taskRequirements: [{ taskId: "5d25e2cc86f77443e47ae019", status: ["complete"] }],
  }, // The Huntsman Path - Outcasts <- The Huntsman Path - Forest Cleaning
  "5d25e2c386f77443e7549029": {
    taskRequirements: [{ taskId: "5d25e2b486f77409de05bba0", status: ["complete"] }],
  }, // The Huntsman Path - Trophy <- The Huntsman Path - Secured Perimeter
  "5d25b6be86f77444001e1b89": {
    taskRequirements: [{ taskId: "5d25aed386f77442734d25d2", status: ["complete"] }],
  }, // The Survivalist Path - Thrifty <- The Survivalist Path - Unprotected but Dangerous
  "5bc4776586f774512d07cf05": {
    taskRequirements: [{ taskId: "5d24b81486f77439c92d6ba8", status: ["complete"] }],
  }, // The Tarkov Shooter - Part 1 <- Acquaintance
  "665eeacf5d86b6c8aa03c79b": {
    taskRequirements: [{ taskId: "63a88045abf76d719f42d715", status: ["complete"] }],
  }, // Thirsty - Hounds <- The Delicious Sausage
  "675c1cf4a757ddd00404f0a3": {
    taskRequirements: [{ taskId: "5d24b81486f77439c92d6ba8", status: ["complete"] }],
  }, // Work Smarter <- Acquaintance

  // --- Mechanic ---
  "6752f6d83038f7df520c83e8": {
    taskRequirements: [{ taskId: "657315e4a6af4ab4b50f3459", status: ["complete"] }],
  }, // A Helping Hand <- Saving the Mole
  "6089736efa70fc097863b8f6": {
    taskRequirements: [{ taskId: "5ac3477486f7741d651d6885", status: ["complete"] }],
  }, // Back Door <- Scout
  "669fa39b91b0a8c9680fc467": {
    taskRequirements: [{ taskId: "5ac3477486f7741d651d6885", status: ["complete"] }],
  }, // Black Swan <- Scout
  "60e71d23c1bfa3050473b8e6": {
    taskRequirements: [{ taskId: "5f04886a3937dc337a6b8238", status: ["complete"] }],
  }, // Calibration <- Chemistry Closet
  "5c0be13186f7746f016734aa": {
    taskRequirements: [{ taskId: "5a27bc8586f7741b543d8ea4", status: ["complete"] }],
  }, // Psycho Sniper <- Wet Job - Part 6
  "67a09636b8725511260bc421": {
    taskRequirements: [{ taskId: "657315e4a6af4ab4b50f3459", status: ["complete"] }],
  }, // Shady Contractor <- Saving the Mole
  "6089732b59b92115597ad789": {
    taskRequirements: [{ taskId: "6089736efa70fc097863b8f6", status: ["complete"] }],
  }, // Surplus Goods <- Back Door
  "639136fa9444fb141f4e6eee": {
    taskRequirements: [{ taskId: "63913715f8e5dd32bf4e3aaa", status: ["complete"] }],
  }, // Watching You <- Broadcast - Part 2

  // --- Peacekeeper ---
  "5a27b80086f774429a5d7e20": {
    taskRequirements: [{ taskId: "5a27b7d686f77460d847e6a6", status: ["complete"] }],
  }, // Eagle Eye <- Scrap Metal
  "66aa58245ab22944110db6e9": {
    taskRequirements: [{ taskId: "639135f286e646067c176a87", status: ["complete"] }],
  }, // New Paths <- Revision - Streets of Tarkov
  "669fa38fad7f1eac2607ed46": {
    taskRequirements: [{ taskId: "6179aff8f57fb279792c60a1", status: ["complete"] }],
  }, // One Less Loose End <- Overpopulation
  "5a03153686f77442d90e2171": {
    taskRequirements: [{ taskId: "5a27b87686f77460de0252a8", status: ["complete"] }],
  }, // One-Way Ticket <- Humanitarian Supplies
  "6179b4d1bca27a099552e04e": {
    taskRequirements: [{ taskId: "6086c852c945025d41566124", status: ["complete"] }],
  }, // Revision - Lighthouse <- Revision - Reserve
  "5edac020218d181e29451446": {
    taskRequirements: [
      { taskId: "5eda19f0edce541157209cee", status: ["complete"] },
      { taskId: "5a27b75b86f7742e97191958", status: ["complete"] },
    ],
  }, // Samples <- Anesthesia + Fishing Gear
  "5a27b7d686f77460d847e6a6": {
    taskRequirements: [{ taskId: "5a27b7a786f774579c3eb376", status: ["complete"] }],
  }, // Scrap Metal <- Tigr Safari
  "675c1d6d59b0575973008fc7": {
    taskRequirements: [{ taskId: "5a27b87686f77460de0252a8", status: ["complete"] }],
  }, // Seizing the Initiative <- Humanitarian Supplies
  "60e71c9ad54b755a3b53eb66": {
    taskRequirements: [{ taskId: "5c0d4e61d09282029f53920e", status: ["complete"] }],
  }, // The Cleaner <- The Guide
  "5c0d4e61d09282029f53920e": {
    taskRequirements: [{ taskId: "5a27bc8586f7741b543d8ea4", status: ["complete"] }],
  }, // The Guide <- Wet Job - Part 6
  "5a27b7a786f774579c3eb376": {
    taskRequirements: [{ taskId: "5a27b75b86f7742e97191958", status: ["complete"] }],
  }, // Tigr Safari <- Fishing Gear
  "60e71ccb5688f6424c7bfec4": {
    taskRequirements: [{ taskId: "5d25e2cc86f77443e47ae019", status: ["complete"] }],
  }, // Trophies <- The Huntsman Path - Forest Cleaning
  "63a9b229813bba58a50c9ee5": {
    taskRequirements: [
      { taskId: "639135f286e646067c176a87", status: ["complete"] },
      { taskId: "5a27bc6986f7741c7358402b", status: ["complete"] },
    ],
  }, // Worst Job in the World <- Revision - Streets of Tarkov + Wet Job - Part 5

  // --- Prapor ---
  "5eda19f0edce541157209cee": {
    taskRequirements: [{ taskId: "5967725e86f774601a446662", status: ["complete"] }],
  }, // Anesthesia <- Shaking Up the Teller
  "63a9ae24009ffc6a551631a5": {
    taskRequirements: [{ taskId: "59ca2eb686f77445a80ed049", status: ["complete"] }],
  }, // Best Job in the World <- The Punisher - Part 6
  "60e71b9bbd90872cb85440f3": {
    taskRequirements: [{ taskId: "59ca2eb686f77445a80ed049", status: ["complete"] }],
  }, // Capturing Outposts <- The Punisher - Part 6
  "60896b7bfa70fc097863b8f5": {
    taskRequirements: [{ taskId: "60896bca6ee58f38c417d4f2", status: ["complete"] }],
  }, // Documents <- No Place for Renegades
  "6179ac7511973d018217d0b9": {
    taskRequirements: [{ taskId: "59c50a9e86f7745fef66f4ff", status: ["complete"] }],
  }, // Easy Job <- The Punisher - Part 2
  "669fa3a40c828825de06d6a1": {
    taskRequirements: [{ taskId: "6574e0dedc0d635f633a5805", status: ["complete"] }],
  }, // Easy-Breezy <- Getting Some Air
  "60e71b62a0beca400d69efc4": {
    taskRequirements: [{ taskId: "59ca2eb686f77445a80ed049", status: ["complete"] }],
  }, // Escort <- The Punisher - Part 6
  "6574e0dedc0d635f633a5805": {
    taskRequirements: [{ taskId: "64f5deac39e45b527a7c4232", status: ["complete"] }],
  }, // Getting Some Air <- Job for a Patriot
  "5c0d190cd09282029f5390d8": {
    taskRequirements: [{ taskId: "657315df034d76585f032e01", status: ["complete"] }],
  }, // Grenadier <- Shooting Cans
  "60e71bb4e456d449cd47ca75": {
    taskRequirements: [{ taskId: "59ca2eb686f77445a80ed049", status: ["complete"] }],
  }, // Intimidator <- The Punisher - Part 6
  "64f5deac39e45b527a7c4232": {
    taskRequirements: [{ taskId: "63a5cf262964a7488f5243ce", status: ["complete"] }],
  }, // Job for a Patriot <- Power of Persuasion
  "639136f086e646067c176a8b": {
    taskRequirements: [{ taskId: "59ca264786f77445a80ed044", status: ["complete"] }],
  }, // Kings of the Rooftops <- The Punisher - Part 4
  "657315e1dccd301f1301416a": {
    taskRequirements: [{ taskId: "5936d90786f7742b1420ba5b", status: ["complete"] }],
  }, // Luxurious Life <- Debut
  "6179b5b06e9dd54ac275e409": {
    taskRequirements: [{ taskId: "59ca29fb86f77445ab465c87", status: ["complete"] }],
  }, // Our Own Land <- The Punisher - Part 5
  "669fa399033a3ce9870338a8": {
    taskRequirements: [{ taskId: "59675ea386f77414b32bded2", status: ["complete"] }],
  }, // Possessor <- Postman Pat - Part 1
  "5fd9fad9c1ce6b1a3b486d00": {
    taskRequirements: [{ taskId: "5936d90786f7742b1420ba5b", status: ["complete"] }],
  }, // Search Mission <- Debut
  "66ab970848ddbe9d4a0c49a8": {
    taskRequirements: [{ taskId: "60896b7bfa70fc097863b8f5", status: ["complete"] }],
  }, // Special Comms <- Documents
  "67b45467814ab0ffa000c7e7": {
    taskRequirements: [{ taskId: "5c0d190cd09282029f5390d8", status: ["complete"] }],
  }, // The Art of Explosion <- Grenadier
  "666314b4d7f171c4c20226c3": {
    taskRequirements: [{ taskId: "657315df034d76585f032e01", status: ["complete"] }],
  }, // The Good Times - Part 1 <- Shooting Cans
  "675c1ff1a757ddd00404f0aa": {
    taskRequirements: [{ taskId: "669fa3a40c828825de06d6a1", status: ["complete"] }],
  }, // Unique Experience <- Easy-Breezy
  "6391359b9444fb141f4e6ee6": {
    taskRequirements: [{ taskId: "59675ea386f77414b32bded2", status: ["complete"] }],
  }, // You've Got Mail <- Postman Pat - Part 1

  // --- Ragman ---
  "639135bbc115f907b14700a6": {
    taskRequirements: [
      { taskId: "5b478d0f86f7744d190d91b5", status: ["complete"] },
      { taskId: "639135a7e705511c8a4a1b78", status: ["complete"] },
    ],
  }, // Audiophile <- Minibus + Ballet Lover
  "639135a7e705511c8a4a1b78": {
    taskRequirements: [{ taskId: "638fcd23dc65553116701d33", status: ["complete"] }],
  }, // Ballet Lover <- Audit
  "65734c186dc1e402c80dc19e": {
    taskRequirements: [{ taskId: "639135a7e705511c8a4a1b78", status: ["complete"] }],
  }, // Dandies <- Ballet Lover
  "6613f3007f6666d56807c929": {
    taskRequirements: [{ taskId: "5b478d0f86f7744d190d91b5", status: ["complete"] }],
  }, // Drip-Out - Part 1 <- Minibus
  "66151401efb0539ae10875ae": {
    taskRequirements: [{ taskId: "5b478d0f86f7744d190d91b5", status: ["complete"] }],
  }, // Drip-Out - Part 1 <- Minibus
  "6613f307fca4f2f386029409": {
    taskRequirements: [{ taskId: "65734c186dc1e402c80dc19e", status: ["complete"] }],
  }, // Drip-Out - Part 2 <- Dandies
  "6615141bfda04449120269a7": {
    taskRequirements: [{ taskId: "65734c186dc1e402c80dc19e", status: ["complete"] }],
  }, // Drip-Out - Part 2 <- Dandies
  "65802b627b44fa5e14638899": {
    taskRequirements: [{ taskId: "5ae448e586f7744dcf0c2a67", status: ["complete"] }],
  }, // Nothing Fishy About This <- Big Sale
  "5ae449c386f7744bde357697": {
    taskRequirements: [{ taskId: "5ae449b386f77446d8741719", status: ["complete"] }],
  }, // Pathfinder <- Gratitude
  "5c112d7e86f7740d6f647486": {
    taskRequirements: [{ taskId: "5b478b1886f7744d1b23c57d", status: ["complete"] }],
  }, // Scavenger <- Hot Delivery
  "5e381b0286f77420e3417a74": {
    taskRequirements: [{ taskId: "5ae4496986f774459e77beb6", status: ["complete"] }],
  }, // Textile - Part 1 <- Sew it Good - Part 4
  "5e383a6386f77465910ce1f3": {
    taskRequirements: [{ taskId: "5ae4496986f774459e77beb6", status: ["complete"] }],
  }, // Textile - Part 1 <- Sew it Good - Part 4
  "5ae4498786f7744bde357695": {
    taskRequirements: [{ taskId: "5ae4497b86f7744cf402ed00", status: ["complete"] }],
  }, // The Key to Success <- Sew it Good - Part 2

  // --- Skier ---
  "5979f9ba86f7740f6c3fe9f2": {
    taskRequirements: [{ taskId: "5979eee086f774311955e614", status: ["complete"] }],
  }, // Chemical - Part 1 <- Golden Swag
  "5b4795fb86f7745876267770": {
    taskRequirements: [{ taskId: "5b47926a86f7747ccc057c15", status: ["complete"] }],
  }, // Chumming <- Informed Means Armed
  "6764174c86addd02bc033d68": {
    taskRequirements: [
      { taskId: "5c0bc91486f7746ab41857a2", status: ["complete"] },
      { taskId: "5d25e4ca86f77409dd5cdf2c", status: ["complete"] },
    ],
  }, // Connections Up North <- Silent Caliber + Hunting Trip
  "66058cb22cee99303f1ba067": {
    taskRequirements: [{ taskId: "657315e270bb0b8dba00cc48", status: ["complete"] }],
  }, // Easy Money - Part 1 [PVP ZONE] <- Burning Rubber
  "669fa395c4c5c04798002497": {
    taskRequirements: [{ taskId: "5ac3477486f7741d651d6885", status: ["complete"] }],
  }, // Exit Here <- Scout
  "5b47926a86f7747ccc057c15": {
    taskRequirements: [{ taskId: "5c1234c286f77406fa13baeb", status: ["complete"] }],
  }, // Informed Means Armed <- Setup
  "6179b4f16e9dd54ac275e407": {
    taskRequirements: [{ taskId: "6193850f60b34236ee0483de", status: ["complete"] }],
  }, // Missing Cargo <- Long Road
  "658027799634223183395339": {
    taskRequirements: [{ taskId: "5b4795fb86f7745876267770", status: ["complete"] }],
  }, // No Swiping <- Chumming
  "675c3582f6ddc329a90f9c6d": {
    taskRequirements: [{ taskId: "5b4795fb86f7745876267770", status: ["complete"] }],
  }, // Private Club <- Chumming
  "5c0bc91486f7746ab41857a2": {
    taskRequirements: [{ taskId: "5c0bbaa886f7746941031d82", status: ["complete"] }],
  }, // Silent Caliber <- Bullshit
  "596b43fb86f77457ca186186": {
    taskRequirements: [{ taskId: "596b36c586f77450d6045ad2", status: ["complete"] }],
  }, // The Extortionist <- Supplier
  "669fa39c64ea11e84c0642a6": {
    taskRequirements: [{ taskId: "669fa395c4c5c04798002497", status: ["complete"] }],
  }, // The Walls Have Eyes <- Exit Here
  "626bd75d5bef5d7d590bd415": {
    taskRequirements: [
      { taskId: "6179b4f16e9dd54ac275e407", status: ["complete"] },
      { taskId: "625d700cc48e6c62a440fab5", status: ["complete"] },
    ],
  }, // Top Secret <- Missing Cargo + Getting Acquainted
  "5979ed3886f77431307dc512": {
    taskRequirements: [{ taskId: "596b43fb86f77457ca186186", status: ["complete"] }],
  }, // What's on the Flash Drive? <- The Extortionist

  // --- Therapist ---
  "675c03d1f7da9792a405549a": {
    taskRequirements: [{ taskId: "6179ad56c760af5ad2053587", status: ["complete"] }],
  }, // Abandoned Cargo <- Seaside Vacation
  "596a218586f77420d232807c": {
    taskRequirements: [{ taskId: "5969f9e986f7741dde183a50", status: ["complete"] }],
  }, // Car Repair <- Pharmacist
  "60896e28e4a85c72ef3fa301": {
    taskRequirements: [{ taskId: "5969f9e986f7741dde183a50", status: ["complete"] }],
  }, // Disease History <- Pharmacist
  "626bd75b05f287031503c7f6": {
    taskRequirements: [{ taskId: "6179afd0bca27a099552e040", status: ["complete"] }],
  }, // Drug Trafficking <- Lost Contact
  "5a68661a86f774500f48afb0": {
    taskRequirements: [{ taskId: "5969f9e986f7741dde183a50", status: ["complete"] }],
  }, // Health Care Privacy - Part 1 <- Pharmacist
  "6179afd0bca27a099552e040": {
    taskRequirements: [{ taskId: "5a68663e86f774501078f78a", status: ["complete"] }],
  }, // Lost Contact <- Health Care Privacy - Part 2
  "6179ad56c760af5ad2053587": {
    taskRequirements: [{ taskId: "60896e28e4a85c72ef3fa301", status: ["complete"] }],
  }, // Seaside Vacation <- Disease History
  "675c047fa46173572a0bd878": {
    taskRequirements: [{ taskId: "675c03d1f7da9792a405549a", status: ["complete"] }],
  }, // Shipment Tracking <- Abandoned Cargo
  "596a0e1686f7741ddf17dbee": {
    taskRequirements: [{ taskId: "5969f9e986f7741dde183a50", status: ["complete"] }],
  }, // Supply Plans <- Pharmacist

  // ─── Genuine API-vs-wiki conflicts confirmed 2026-09-08 ─────────────────
  // A second pass over the remaining "API already has a requirement, but a
  // different one than the wiki" cases (excluded from the first pass above
  // since a bare disagreement is too ambiguous to act on alone). Resolved
  // via bidirectional corroboration: a predecessor's OWN wiki page lists its
  // `leads to` targets, so a wiki-claimed link is trustworthy when the
  // claimed predecessor's own page independently names this task back (not
  // just this task's own `previous` field, which could itself be stale).
  // Only applied where exactly one side had that independent corroboration
  // and the other side had none; a case with corroboration on both sides, or
  // neither, was left alone. This reversed an initial hunch on the two
  // "[PVP ZONE]" entries below (guessed the API was right until the actual
  // cross-check showed "Against the Conscience - Part 2"'s own `leads to`
  // list names Between Two Fires, Decisions, Decisions, AND Surprise Gift as
  // three parallel siblings, not a sequential chain through Between Two
  // Fires) - a reminder to run the real check instead of trusting a plausible
  // guess. The other ~71 remaining conflicts had corroboration on both sides
  // or neither and still need individual manual review.
  "5d25d2c186f77443e35162e5": {
    taskRequirements: [{ taskId: "5d25c81b86f77443e625dd71", status: ["complete"] }],
  }, // The Survivalist Path - Cold Blooded <- The Survivalist Path - Wounded Beast (API wrongly said Huntsman Path - Controller)
  "5d25e29d86f7740a22516326": {
    taskRequirements: [{ taskId: "5d25cf2686f77443e75488d4", status: ["complete"] }],
  }, // The Survivalist Path - Eagle-Owl <- The Survivalist Path - Tough Guy (API wrongly said Cold Blooded)
  "5d25c81b86f77443e625dd71": {
    taskRequirements: [{ taskId: "5d25bfd086f77442734d3007", status: ["complete"] }],
  }, // The Survivalist Path - Wounded Beast <- The Survivalist Path - Zhivchik (API wrongly said Unprotected but Dangerous)
  "63966faeea19ac7ed845db2c": {
    taskRequirements: [{ taskId: "625d700cc48e6c62a440fab5", status: ["complete"] }],
  }, // Information Source <- Getting Acquainted (API wrongly said Knock-Knock)
  "67e993b1ac26bf29380a320b": {
    taskRequirements: [{ taskId: "66058ccde8e4f17985230807", status: ["complete"] }],
  }, // Surprise Gift [PVP ZONE] <- Against the Conscience - Part 2 [PVP ZONE] (API wrongly said Between Two Fires)
  "66058cd19f59e625462acc90": {
    taskRequirements: [{ taskId: "66058ccde8e4f17985230807", status: ["complete"] }],
  }, // Decisions, Decisions [PVP ZONE] <- Against the Conscience - Part 2 [PVP ZONE] (API wrongly said Between Two Fires)
  "69788c2bac719606e40b4e77": {
    taskRequirements: [{ taskId: "66058cb7c7f3584787181476", status: ["complete"] }],
  }, // Professional Fitness - Part 1 [PVP ZONE] <- Balancing - Part 1 [PVP ZONE] (API wrongly said the malformed "Arena Business [PVP ZONE]\n" entry)
};
