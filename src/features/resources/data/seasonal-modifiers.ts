/**
 * Season 2 ("Untar Control") modifiers, transcribed from BSG's announcement
 * image (November 2026). BSG notes the values may change before the season
 * starts. Hemophilia's line was only in Russian on the image and is
 * translated here.
 *
 * Icons: the 34 modifiers returning from Season 1 use tarkov.dev's official
 * icons (its `pvp-season/season` endpoint); the 28 new ones are cut from
 * BSG's announcement image. Swap in tarkov.dev's data and icons once it
 * publishes Season 2.
 *
 * Points follow BSG's notation: a positive modifier costs points (shown
 * "(-2)", stored as -2), a negative one gives points ("(+3)", stored as 3).
 * The balance starts at 0 and there's no limit on picks.
 */

/** The season these modifiers belong to; part of the saved-picks key so seasons never mix. */
export const MODIFIER_SEASON = { id: "untar-control", name: "Untar Control", number: 2 } as const;

export type ModifierKind = "global" | "positive" | "negative";

export type ModifierCategory =
  "stamina" | "food" | "health" | "skills" | "hideout" | "traders" | "loot" | "combat" | "raids";

export interface SeasonalModifier {
  /** Kebab-case, also the icon's filename under `public/images/seasonal-modifiers/`. */
  id: string;
  name: string;
  kind: ModifierKind;
  /** Signed as BSG writes it: negative for a positive modifier's cost, positive for points a negative modifier gives, 0 for global. */
  points: number;
  /** One entry per bullet on BSG's card. */
  effects: readonly string[];
  /** Icon path under `public/`. */
  icon: string;
  /** True when it also existed in Season 1 (its icon comes from tarkov.dev). */
  returning: boolean;
}

function icon(id: string, returning: boolean): string {
  return `/images/seasonal-modifiers/${id}.${returning ? "webp" : "png"}`;
}

function mod(
  id: string,
  name: string,
  kind: ModifierKind,
  points: number,
  returning: boolean,
  effects: readonly string[],
): SeasonalModifier {
  return { id, name, kind, points, effects, icon: icon(id, returning), returning };
}

/** Every modifier in BSG's order: row by row across their three-column grid. */
export const SEASONAL_MODIFIERS: readonly SeasonalModifier[] = [
  mod("untar-control", "Untar Control", "global", 0, false, [
    "UN troops appear throughout Tarkov. They're hostile toward all Scavs and PMCs who break the new rules",
    "UN troops control various areas across locations",
  ]),
  mod("tough-times", "Tough Times", "global", 0, false, [
    "Access to extracts is limited",
    "At the start of the season, the Player Scav respawn timer is significantly increased",
  ]),
  mod("peace-market", "Peace Market", "global", 0, false, [
    "Flea Market becomes available to all players after completing a new global task",
    "Minimal restrictions on listing items",
  ]),
  mod("no-insurance", "No Insurance", "global", 0, true, ["Insurance is unavailable"]),
  mod("supply-shortage", "Supply Shortage", "global", 0, false, [
    "Tarkov is experiencing shortages of food, medical supplies, large backpacks, and explosives",
  ]),
  mod("smart-pmcs", "Smart PMCs", "global", 0, false, [
    "Skill progression speed is increased by 25%",
  ]),

  mod("lockpicker", "Lockpicker", "positive", -1, false, [
    "Unlock the ability to pick padlocks on doors and containers using a multitool",
  ]),
  mod("introvert", "Introvert", "positive", -1, false, [
    "Skill progression speed is increased by 30% when playing solo",
  ]),
  mod("tap-rack-roll", "Tap, Rack, Roll", "positive", -1, false, [
    "Start with the Troubleshooting skill at level 40",
    "Malfunction clearing no longer requires inspection",
  ]),
  mod("enhanced-secure-container", "Enhanced Secure Container", "positive", -2, false, [
    "Start with Secure Container Epsilon X with the ability to retain the FiR status of items inside even after death",
  ]),
  mod("fast-crafting", "Fast Crafting", "positive", -2, false, [
    "Start with the Crafting skill at level 40",
    "This skill's progression speed is increased by 100%",
  ]),
  mod("refs-builders", "Ref's Builders", "positive", -2, false, [
    "Build Hideout zones with GP coins and Lega Medals",
  ]),
  mod("kleptomaniac", "Kleptomaniac", "positive", -2, false, [
    "Start with the Search skill at level 40",
    "This skill's progression speed is increased by 100%",
  ]),
  mod("friends-extract", "Friend's Extract", "positive", -2, false, [
    "One additional Scav extract is available in every PMC raid (if the location has them)",
  ]),
  mod("heavyweight", "Heavyweight", "positive", -2, false, [
    "Movement speed is reduced by 5%",
    "Maximum carry weight is increased by 30 kg (Overweight threshold increased by 5 kg)",
  ]),
  mod("cold-blooded", "Cold-Blooded", "positive", -4, false, [
    "Your in-raid body temperature is lower, making you significantly harder to see with thermal optics",
  ]),
  mod("advanced-hideout", "Advanced Hideout", "positive", -4, false, [
    "Start with pre-built Hideout zones: Bitcoin Farm, Gym, Scav Case, and more",
  ]),
  mod("peacekeepers-insurance", "Peacekeeper's Insurance", "positive", -4, false, [
    "Peacekeeper provides gear insurance service for Euros",
  ]),
  mod("marathon-runner", "Marathon Runner", "positive", -5, true, [
    "Arm and leg stamina is consumed 25% slower",
  ]),
  mod("safecracker", "Safecracker", "positive", -4, true, [
    "Mechanical keys and keycards have a 50% chance not to lose durability when used",
  ]),
  mod("bushborne", "Bushborne", "positive", -4, true, [
    "Walking in vegetation generates 75% less noise and doesn't inflict movement slowdown",
  ]),
  mod("juice-time", "Juice Time", "positive", -1, true, [
    "Consuming a juice drink grants the Painkiller effect for 240 seconds",
  ]),
  mod("sailors-nostalgia", "Sailor's Nostalgia", "positive", -2, true, [
    "Consuming canned fish grants the Health Regeneration (+1) effect for 600 seconds",
  ]),
  mod("youth", "Youth", "positive", -6, true, [
    "Energy is consumed 20% slower",
    "Arm and leg stamina is increased by 25 points",
  ]),
  mod("street-tax", "Street Tax", "positive", -2, true, [
    "Once per week, some Scavs pay you a large amount of protection money",
  ]),
  mod("the-tarkov-shooter", "The Tarkov Shooter", "positive", -2, true, [
    "Start with the Bolt-action Rifles skill at level 51",
  ]),
  mod("diet", "Diet", "positive", -1, true, ["All provisions consume 50% less resource"]),
  mod("hercules", "Hercules", "positive", -6, true, [
    "Start with the Strength and Endurance skills at level 20",
  ]),
  mod("sprinter", "Sprinter", "positive", -4, true, ["Running speed is increased by 15%"]),
  mod("thrombophilia", "Thrombophilia", "positive", -6, true, [
    "Bleeding chance is decreased by 100%",
  ]),
  mod("prodigy", "Prodigy", "positive", -4, true, ["Skill progression speed is increased by 20%"]),
  mod("hypodipsia", "Hypodipsia", "positive", -2, true, ["Hydration is consumed 50% slower"]),
  mod("polyphagia", "Polyphagia", "positive", -2, true, ["Energy is consumed 45% slower"]),
  mod("sturdy-bones", "Sturdy Bones", "positive", -2, true, [
    "Limb fracture chance is decreased by 50%",
    "Falling from heights deals 30% less damage",
  ]),
  mod("average", "Average", "positive", -8, true, [
    "All character skills are set to level 30 but cannot be leveled further",
  ]),
  mod("kappa-protocol", "Kappa Protocol", "positive", -8, true, [
    "Start with Secure container Kappa",
  ]),
  mod("lucky", "Lucky", "positive", -1, true, ["Audentes fortuna iuvat!"]),

  mod("extrovert", "Extrovert", "negative", 3, false, [
    "Skill progression speed is decreased by 30% when playing solo",
  ]),
  mod("schizo", "Schizo", "negative", 2, false, [
    "Your character occasionally hears phantom sounds",
  ]),
  mod("no-repairs", "No Repairs", "negative", 2, false, [
    "Items cannot be repaired through traders",
  ]),
  mod("loose-tongue", "Loose Tongue", "negative", 2, false, [
    "Your character occasionally does a voice line after performing any action",
  ]),
  mod("three-fingered", "Three-Fingered", "negative", 2, false, [
    "15% chance of dropping a magazine when reloading",
  ]),
  mod("no-love-from-fence", "No Love From Fence", "negative", 2, false, [
    "Start with Fence reputation at -7.0",
  ]),
  mod("zero-to-hero", "Zero to Hero", "negative", 2, false, [
    "Start with a completely empty character, no bonus items",
  ]),
  mod("shaky-aim", "Shaky Aim", "negative", 3, false, [
    "Aiming for more than 3 seconds causes hand tremors, pain, and tunnel vision",
  ]),
  mod("no-scav-runs", "No Scav Runs", "negative", 3, false, ["Unable to play as a Scav"]),
  mod("deadline", "Deadline", "negative", 4, false, [
    "You must reach any ending within 30 days. Failure to meet the deadline results in a wipe for the seasonal character",
  ]),
  mod("coagulopathy", "Coagulopathy", "negative", 3, false, [
    "Any bleeding immediately becomes a Heavy Bleeding",
  ]),
  mod("hemophilia", "Hemophilia", "negative", 2, true, ["Bleeding chance is increased by 70%"]),
  mod("osteoporosis", "Osteoporosis", "negative", 2, true, [
    "Limb fracture chance is increased by 50%",
    "Falling from heights deals 50% more damage",
  ]),
  mod("exhaustion", "Exhaustion", "negative", 5, true, [
    "Arm and leg stamina is reduced by 20 points",
  ]),
  mod("well-that-hurt", "Well That Hurt!", "negative", 1, true, [
    "All medkit uses consume 33% more resource",
  ]),
  mod("incompetent", "Incompetent", "negative", 8, true, [
    "Skill progression speed is decreased by 100%",
  ]),
  mod("polydipsia", "Polydipsia", "negative", 1, true, ["Hydration is consumed 25% faster"]),
  mod("chronic-fatigue-syndrome", "Chronic Fatigue Syndrome", "negative", 1, true, [
    "Energy is consumed 20% faster",
  ]),
  mod("personality-vacuum", "Personality Vacuum", "negative", 6, true, [
    "Charisma skill cannot be increased",
    "All trader items and services cost 50% more",
  ]),
  mod("dr-jekyll", "Dr. Jekyll", "negative", 2, true, [
    "After gaining the Fresh Wound status, it cannot be removed until the end of the raid",
  ]),
  mod("allergic", "Allergic", "negative", 2, true, [
    "Become allergic to 4 random items from the Provisions or Medication category",
  ]),
  mod("broken-secure-container", "Broken Secure Container", "negative", 6, true, [
    "Secure container can only be filled with cash, keys, dogtags, stimulants, special equipment, certain containers, and Battle Pass documents",
  ]),
  mod("no-flea-market", "No Flea Market", "negative", 8, true, [
    "Trading with players on the Flea Market is disabled",
  ]),
  mod("third-leg", "Third Leg", "negative", 1, true, [
    "Movement speed is decreased by 2%",
    "Buying items at Therapist is 5% cheaper",
  ]),
  mod("unlucky", "Unlucky", "negative", 1, true, [
    "Your bad luck can sometimes have dire consequences",
  ]),
];

/** The highlight categories, in button order, with every member (a modifier can be in several). */
export const MODIFIER_CATEGORIES: readonly {
  id: ModifierCategory;
  label: string;
  members: readonly string[];
}[] = [
  {
    id: "stamina",
    label: "Stamina & movement",
    members: [
      "marathon-runner",
      "youth",
      "sprinter",
      "heavyweight",
      "bushborne",
      "hercules",
      "exhaustion",
      "third-leg",
    ],
  },
  {
    id: "food",
    label: "Food, drink & energy",
    members: [
      "juice-time",
      "sailors-nostalgia",
      "diet",
      "hypodipsia",
      "polyphagia",
      "youth",
      "polydipsia",
      "chronic-fatigue-syndrome",
      "allergic",
      "supply-shortage",
    ],
  },
  {
    id: "health",
    label: "Health & injuries",
    members: [
      "thrombophilia",
      "sturdy-bones",
      "juice-time",
      "sailors-nostalgia",
      "hemophilia",
      "coagulopathy",
      "osteoporosis",
      "well-that-hurt",
      "dr-jekyll",
      "allergic",
      "supply-shortage",
    ],
  },
  {
    id: "skills",
    label: "Skills & progression",
    members: [
      "introvert",
      "tap-rack-roll",
      "fast-crafting",
      "kleptomaniac",
      "the-tarkov-shooter",
      "hercules",
      "prodigy",
      "average",
      "extrovert",
      "incompetent",
      "personality-vacuum",
      "smart-pmcs",
    ],
  },
  {
    id: "hideout",
    label: "Hideout & crafting",
    members: ["refs-builders", "advanced-hideout", "fast-crafting"],
  },
  {
    id: "traders",
    label: "Traders, money & flea",
    members: [
      "peacekeepers-insurance",
      "street-tax",
      "refs-builders",
      "no-repairs",
      "no-love-from-fence",
      "personality-vacuum",
      "no-flea-market",
      "third-leg",
      "peace-market",
      "no-insurance",
    ],
  },
  {
    id: "loot",
    label: "Containers, keys & loot",
    members: [
      "lockpicker",
      "enhanced-secure-container",
      "safecracker",
      "kappa-protocol",
      "kleptomaniac",
      "broken-secure-container",
      "zero-to-hero",
    ],
  },
  {
    id: "combat",
    label: "Combat & stealth",
    members: [
      "cold-blooded",
      "bushborne",
      "the-tarkov-shooter",
      "tap-rack-roll",
      "three-fingered",
      "shaky-aim",
      "loose-tongue",
      "schizo",
    ],
  },
  {
    id: "raids",
    label: "Raids, extracts & luck",
    members: [
      "friends-extract",
      "no-scav-runs",
      "deadline",
      "lucky",
      "unlucky",
      "untar-control",
      "tough-times",
    ],
  },
];

/** A pair of modifiers that can't be picked together. */
export interface ModifierClash {
  a: string;
  b: string;
  /** `"season1"`: BSG blocked this exact pair in Season 1. `"guess"`: our own reasoning, not confirmed. */
  source: "season1" | "guess";
  /** Why we think so; set on guesses. */
  reason?: string;
}

/**
 * Pairs BSG blocked in Season 1 (tarkov.dev's `exclusiveToPerks`), kept
 * where both modifiers return in Season 2.
 */
const SEASON_ONE_CLASHES: readonly [string, string][] = [
  ["hemophilia", "thrombophilia"],
  ["osteoporosis", "sturdy-bones"],
  ["incompetent", "average"],
  ["incompetent", "prodigy"],
  ["average", "prodigy"],
  ["average", "the-tarkov-shooter"],
  ["average", "hercules"],
  ["polydipsia", "hypodipsia"],
  ["chronic-fatigue-syndrome", "polyphagia"],
  ["chronic-fatigue-syndrome", "youth"],
  ["youth", "polyphagia"],
  ["youth", "exhaustion"],
  ["marathon-runner", "exhaustion"],
  ["marathon-runner", "sprinter"],
  ["third-leg", "sprinter"],
  ["third-leg", "personality-vacuum"],
  ["lucky", "unlucky"],
];

/** Our guesses for Season 2, each with the reasoning shown to the reader. */
const GUESSED_CLASHES: readonly [string, string, string][] = [
  ["introvert", "extrovert", "They're exact opposites."],
  [
    "incompetent",
    "introvert",
    "Season 1 blocked Incompetent with Prodigy, the other skill speed boost.",
  ],
  [
    "average",
    "introvert",
    "Average locks skills, and Season 1 blocked it with every skill speed change.",
  ],
  [
    "average",
    "extrovert",
    "Average locks skills, and Season 1 blocked it with every skill speed change.",
  ],
  [
    "average",
    "fast-crafting",
    "Average locks skills at 30, and Season 1 blocked it with modifiers that set a skill level.",
  ],
  [
    "average",
    "kleptomaniac",
    "Average locks skills at 30, and Season 1 blocked it with modifiers that set a skill level.",
  ],
  [
    "average",
    "tap-rack-roll",
    "Average locks skills at 30, and Season 1 blocked it with modifiers that set a skill level.",
  ],
  ["thrombophilia", "coagulopathy", "With no bleeding at all, Coagulopathy would never trigger."],
  ["kappa-protocol", "enhanced-secure-container", "Both replace your secure container."],
  [
    "zero-to-hero",
    "kappa-protocol",
    "Zero to Hero starts you with nothing, just depends if BSG includes secure containers or not.",
  ],
  [
    "zero-to-hero",
    "enhanced-secure-container",
    "Zero to Hero starts you with nothing, just depends if BSG includes secure containers or not.",
  ],
  [
    "heavyweight",
    "sprinter",
    "Season 1 blocked Sprinter with Third Leg, which also slows movement.",
  ],
];

/** Every known clash, confirmed ones first. */
export const MODIFIER_CLASHES: readonly ModifierClash[] = [
  ...SEASON_ONE_CLASHES.map(([a, b]): ModifierClash => ({ a, b, source: "season1" })),
  ...GUESSED_CLASHES.map(([a, b, reason]): ModifierClash => ({ a, b, source: "guess", reason })),
];
