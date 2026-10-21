import type { JsonApiMapsData, JsonApiMob } from "./json-api-types";
import type { RawMob, RawMobGearOption } from "./types";

/**
 * The game's worn equipment slots: the only `equipment[].attributes.slot`
 * values that describe what a boss is actually wearing or wielding. Every
 * other slot id in the raw list (`"pocket1"`, `"main"`, `"cartridges"`,
 * `"Front_plate"`, `"mod_nvg"`, ...) is something nested inside that gear,
 * which either repeats the loot list (pocket and bag contents) or can't be
 * looted at all (secure container contents also land in `"main"`).
 */
export const WORN_GEAR_SLOTS: readonly string[] = [
  "FirstPrimaryWeapon",
  "SecondPrimaryWeapon",
  "Holster",
  "Scabbard",
  "Headwear",
  "Earpiece",
  "FaceCover",
  "Eyewear",
  "ArmorVest",
  "TacticalVest",
  "Backpack",
  "ArmBand",
];

const WORN_GEAR_SLOT_SET: ReadonlySet<string> = new Set(WORN_GEAR_SLOTS);

const WEAPON_SLOTS: ReadonlySet<string> = new Set([
  "FirstPrimaryWeapon",
  "SecondPrimaryWeapon",
  "Holster",
]);

/** Slot ids a weapon's loaded rounds sit in: a magazine's own rounds, and the chambered one. */
const LOADED_AMMO_SLOTS: ReadonlySet<string> = new Set(["cartridges", "patron_in_weapon"]);

/**
 * Escort-only mobs the Maps boss strip shows as pills of their own: the
 * Goons' squadmates, which the API lists only as Knight's `escorts`, never as
 * a map boss. `features/maps/lib/boss-groups.ts` reads this same list, so the
 * server summary and the strip can't drift apart.
 */
export const GOON_FOLLOWER_MOB_IDS = {
  bigPipe: "followerBigPipe",
  birdeye: "followerBirdEye",
} as const;

/** Rounds a 0..1 fraction to 4 decimals: exactly upstream's own precision (prevalence is a 2-decimal percentage, e.g. 0.23 becomes 0.0023), and keeps the cached payload small. */
function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Compacts one raw mob into {@link RawMob}. Gear chance is an estimate, not
 * read: upstream's `equipment` is the union of a handful of generated sample
 * loadouts with no per-item probability, and upstream never says how many
 * samples there are. The count is inferred instead: every boss carries a
 * primary weapon in every sample (checked across all of them 2026-10-19,
 * `FirstPrimaryWeapon` always has exactly 15 entries per difficulty), so the
 * most-filled worn slot's entry count is taken as the sample size, and an
 * item's chance is how many entries it has in its slot divided by that.
 * With so few samples each one moves a figure by several percent, which is
 * why the card labels these as rough estimates.
 */
export function summarizeMob(mob: JsonApiMob): RawMob {
  const slotCounts = new Map<string, number>();
  const options = new Map<
    string,
    { slot: string; itemId: string; count: number; ammo: Set<string> }
  >();

  for (const entry of mob.equipment ?? []) {
    const slot = entry.attributes?.slot;
    if (!slot || !WORN_GEAR_SLOT_SET.has(slot)) continue;
    slotCounts.set(slot, (slotCounts.get(slot) ?? 0) + 1);

    const key = `${slot}|${entry.item}`;
    const option = options.get(key) ?? { slot, itemId: entry.item, count: 0, ammo: new Set() };
    option.count += 1;
    if (WEAPON_SLOTS.has(slot)) {
      for (const part of entry.contains ?? []) {
        const partSlot = part.attributes?.slotNameId;
        if (partSlot && LOADED_AMMO_SLOTS.has(partSlot)) option.ammo.add(part.item);
      }
    }
    options.set(key, option);
  }

  const gearSamples = Math.max(0, ...slotCounts.values());
  const gear: RawMobGearOption[] = [...options.values()].map((option) => ({
    slot: option.slot,
    itemId: option.itemId,
    chance: round4(option.count / gearSamples),
    ...(option.ammo.size > 0 ? { ammoItemIds: [...option.ammo] } : {}),
  }));

  const health = (mob.health ?? []).reduce((total, part) => total + part.max, 0);

  return {
    id: mob.id,
    name: mob.name,
    normalizedName: mob.normalizedName,
    imagePortraitLink: mob.imagePortraitLink,
    health: health > 0 ? health : null,
    healthParts: (mob.health ?? []).map((part) => ({ part: part.id, max: part.max })),
    gearSamples,
    gear,
    // A prevalence that rounded to 0 upstream (hundreds of rows) is noise
    // nobody can act on, so it's dropped rather than shown as "0%".
    loot: (mob.items ?? []).flatMap((entry) => {
      const prevalence = entry.attributes?.prevalence ?? 0;
      return prevalence > 0 ? [{ itemId: entry.id, chance: round4(prevalence / 100) }] : [];
    }),
  };
}

/**
 * Every mob some map lists as a boss, plus the Goons' squadmates (see
 * {@link GOON_FOLLOWER_MOB_IDS}), summarized. Escorts in general are left
 * out on purpose: the strip never shows them, and including every guard
 * nearly doubles the payload (~420 KB vs ~260 KB raw, measured 2026-10-20),
 * which matters because the whole game-data cache is persisted to
 * `localStorage`.
 */
export function joinMobs(mapsData: JsonApiMapsData): readonly RawMob[] {
  const mobsById = mapsData.mobs ?? {};
  const ids = new Set<string>(Object.values(GOON_FOLLOWER_MOB_IDS));
  for (const map of Object.values(mapsData.maps)) {
    for (const boss of map.bosses ?? []) ids.add(boss.mob);
  }
  return [...ids].flatMap((id) => {
    const mob = mobsById[id];
    return mob ? [summarizeMob(mob)] : [];
  });
}
