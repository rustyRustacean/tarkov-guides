import type { NormalizedItem, RawMob } from "@/shared/lib/tarkov-api/types";

/** Worn slots in the order the gear list shows them (weapons first, then head to toe), each with its display label. */
const GEAR_SLOT_ORDER: readonly { slot: string; label: string }[] = [
  { slot: "FirstPrimaryWeapon", label: "Primary" },
  { slot: "SecondPrimaryWeapon", label: "Secondary" },
  { slot: "Holster", label: "Sidearm" },
  { slot: "Scabbard", label: "Melee" },
  { slot: "Headwear", label: "Headwear" },
  { slot: "Earpiece", label: "Headset" },
  { slot: "FaceCover", label: "Face cover" },
  { slot: "Eyewear", label: "Eyewear" },
  { slot: "ArmorVest", label: "Body armor" },
  { slot: "TacticalVest", label: "Rig" },
  { slot: "Backpack", label: "Backpack" },
  { slot: "ArmBand", label: "Armband" },
];

export interface BossGearOption {
  itemId: string;
  /** 0..1 share of sampled spawns with this item in this slot. */
  chance: number;
  /** Rounds seen loaded in this weapon; empty for non-weapons. */
  ammoItemIds: readonly string[];
}

export interface BossGearSlot {
  slot: string;
  label: string;
  /** Most common first. */
  options: readonly BossGearOption[];
}

export interface BossLootEntry {
  itemId: string;
  /** 0..1 share of observed spawns carrying it. */
  chance: number;
}

export interface BossLoadout {
  /** How many of the pill's mobs contributed data: more than 1 means the numbers are combined across a faction's enemy types. */
  sourceCount: number;
  /** Total HP of the pill's main (highest-chance) mob, or `null` when unknown. */
  health: number | null;
  /** Total sampled spawns behind every gear chance (summed across pooled mobs). */
  gearSamples: number;
  gear: readonly BossGearSlot[];
  /** Most common first. */
  loot: readonly BossLootEntry[];
}

/**
 * Pools the gear and loot of every mob behind one boss pill (one for a named
 * boss, several for a faction pill like Black Division). Gear chances are
 * weighted by each mob's sample count, so they stay true "share of all
 * sampled spawns" numbers. Loot chances are a plain average across the mobs
 * that have loot data, since upstream doesn't say how many spawns each
 * mob's loot figures came from. A mob with no data at all (one Rogue variant
 * ships none) is skipped rather than counted as 0% for everything. Returns
 * `null` when none of the mobs has any gear or loot.
 */
export function getBossLoadout(
  mobIds: readonly string[],
  mobsById: Readonly<Record<string, RawMob>>,
): BossLoadout | null {
  const sources = mobIds.flatMap((id) => {
    const mob = mobsById[id];
    return mob && (mob.gear.length > 0 || mob.loot.length > 0) ? [mob] : [];
  });
  if (sources.length === 0) return null;

  const gearSamples = sources.reduce((total, mob) => total + mob.gearSamples, 0);
  const gearByKey = new Map<
    string,
    { slot: string; itemId: string; weighted: number; ammo: Set<string> }
  >();
  for (const mob of sources) {
    for (const option of mob.gear) {
      const key = `${option.slot}|${option.itemId}`;
      const pooled = gearByKey.get(key) ?? {
        slot: option.slot,
        itemId: option.itemId,
        weighted: 0,
        ammo: new Set<string>(),
      };
      pooled.weighted += option.chance * mob.gearSamples;
      for (const ammoId of option.ammoItemIds ?? []) pooled.ammo.add(ammoId);
      gearByKey.set(key, pooled);
    }
  }
  const pooledGear = [...gearByKey.values()];
  const knownSlots = new Set(GEAR_SLOT_ORDER.map((entry) => entry.slot));
  const slotOrder = [
    ...GEAR_SLOT_ORDER,
    // Any worn slot the label table doesn't know yet still shows, under its raw id, last.
    ...[...new Set(pooledGear.map((option) => option.slot))]
      .filter((slot) => !knownSlots.has(slot))
      .map((slot) => ({ slot, label: slot })),
  ];
  const gear = slotOrder.flatMap(({ slot, label }) => {
    const options = pooledGear
      .filter((option) => option.slot === slot)
      .map((option) => ({
        itemId: option.itemId,
        chance: gearSamples > 0 ? option.weighted / gearSamples : 0,
        ammoItemIds: [...option.ammo],
      }))
      .sort((a, b) => b.chance - a.chance);
    return options.length > 0 ? [{ slot, label, options }] : [];
  });

  const lootSources = sources.filter((mob) => mob.loot.length > 0);
  const lootTotals = new Map<string, number>();
  for (const mob of lootSources) {
    for (const entry of mob.loot) {
      lootTotals.set(entry.itemId, (lootTotals.get(entry.itemId) ?? 0) + entry.chance);
    }
  }
  const loot = [...lootTotals.entries()]
    .map(([itemId, total]) => ({ itemId, chance: total / lootSources.length }))
    .sort((a, b) => b.chance - a.chance);

  return {
    sourceCount: sources.length,
    health: sources[0]?.health ?? null,
    gearSamples,
    gear,
    loot,
  };
}

export type LootTier = "common" | "uncommon" | "rare";

/** The loot list's three bands, most common first, with the range each covers. */
export const LOOT_TIERS: readonly { tier: LootTier; label: string; range: string }[] = [
  { tier: "common", label: "Common", range: "10% or more" },
  { tier: "uncommon", label: "Uncommon", range: "1% to 10%" },
  { tier: "rare", label: "Rare", range: "under 1%" },
];

/** Which {@link LOOT_TIERS} band a 0..1 chance falls in. */
export function lootTier(chance: number): LootTier {
  if (chance >= 0.1) return "common";
  if (chance >= 0.01) return "uncommon";
  return "rare";
}

/**
 * A 0..1 chance as a percentage with just enough precision to tell rare
 * items apart: whole numbers from 10% up ("70%"), one decimal from 1%
 * ("6.1%"), two below that ("0.23%"), and "<0.01%" for anything smaller.
 * Trailing zeros are dropped ("5%", not "5.0%").
 */
export function formatChance(chance: number): string {
  const percent = chance * 100;
  if (percent >= 10) return `${String(Math.round(percent))}%`;
  if (percent >= 1) return `${String(Number(percent.toFixed(1)))}%`;
  if (percent >= 0.01) return `${String(Number(percent.toFixed(2)))}%`;
  return "<0.01%";
}

export type LootCategory = "all" | "keys" | "barter" | "meds" | "other";

/** The loot filter's options, in display order. */
export const LOOT_CATEGORIES: readonly { value: LootCategory; label: string }[] = [
  { value: "all", label: "All" },
  { value: "keys", label: "Keys" },
  { value: "barter", label: "Barter" },
  { value: "meds", label: "Meds" },
  { value: "other", label: "Other" },
];

/** Buckets an item by its tarkov.dev `types` (keycards count as keys). Anything unknown is "other". */
export function lootCategoryOf(item: NormalizedItem | undefined): Exclude<LootCategory, "all"> {
  const types = item?.types ?? [];
  if (types.includes("keys")) return "keys";
  if (types.includes("meds") || types.includes("injectors")) return "meds";
  if (types.includes("barter")) return "barter";
  return "other";
}

/** `loot` narrowed to one category and to items whose name or short name contains `query` (case-insensitive). Order is preserved. */
export function filterLoot(
  loot: readonly BossLootEntry[],
  itemsById: Readonly<Record<string, NormalizedItem>>,
  query: string,
  category: LootCategory,
): readonly BossLootEntry[] {
  const needle = query.trim().toLowerCase();
  return loot.filter((entry) => {
    const item = itemsById[entry.itemId];
    if (category !== "all" && lootCategoryOf(item) !== category) return false;
    if (!needle) return true;
    const name = (item?.name ?? entry.itemId).toLowerCase();
    const shortName = (item?.shortName ?? "").toLowerCase();
    return name.includes(needle) || shortName.includes(needle);
  });
}
