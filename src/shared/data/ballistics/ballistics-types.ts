/**
 * Ballistics stat block, present on ammo/armor records that carry real
 * stats. Confirmed via a full field-enumeration scan of all 195 `ammo.json`
 * records: every non-empty entry has exactly these 9 fields, never a
 * partial subset.
 */
export interface AmmoProperties {
  caliber: string;
  damage: number;
  armorDamage: number;
  penetrationPower: number;
  penetrationChance: number;
  fragmentationChance: number;
  ricochetChance: number;
  tracer: boolean;
  ammoType: string;
}

export interface AmmoEntry {
  id: string;
  name: string;
  shortName: string;
  /** Empty for non-ammo entries in this file (e.g. grenades, ammo-pack containers): 12 of 195 records. */
  properties: AmmoProperties | Record<string, never>;
}

export interface ArmorMaterial {
  id: string;
  name: string;
  destructibility: number;
  explosionDestructibility: number;
}

/**
 * Confirmed via a full field-enumeration scan of all 62 `armor.json`
 * records: every non-empty entry has exactly these 6 fields, never a
 * partial subset.
 */
export interface ArmorProperties {
  class: number;
  durability: number;
  zones: readonly string[];
  bluntThroughput: number;
  armorType: string;
  material: ArmorMaterial;
}

export interface ArmorEntry {
  id: string;
  name: string;
  shortName: string;
  /** Empty for entries in this file that are actually plate carriers/rigs, not body armor: 23 of 62 records. */
  properties: ArmorProperties | Record<string, never>;
}

/**
 * `plates.json` carries zero stat data today: confirmed via a full scan,
 * every one of its 37 records has an empty `properties`. It's a curated
 * "which items count as a ballistic plate" allowlist, not ballistics data.
 * Real plate class/durability isn't sourced anywhere yet (the live
 * GraphQL `items` query doesn't select armor-class fields either); that's
 * a future ballistics-calculator problem, not this loader's.
 */
export interface PlateEntry {
  id: string;
  name: string;
  shortName: string;
  properties: Record<string, never>;
}

/** Same situation as `PlateEntry`: confirmed empty across all 61 `rigs.json` records. */
export interface RigEntry {
  id: string;
  name: string;
  shortName: string;
  properties: Record<string, never>;
}
