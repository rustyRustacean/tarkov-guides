import type { CatalogIndex } from "../catalog/catalog-index";
import type { KitSlotKey } from "../types";

/** Which handbook categories (by slug) each part of a kit accepts. */
interface SlotRules {
  /** The item itself. */
  item: readonly string[];
  /** Things attached to it (weapon mods, plates, visors). Empty means nothing attaches. */
  attachments: readonly string[];
  /** Whether the slot holds a weapon that takes ammo. */
  ammo: boolean;
}

const LONG_GUNS = [
  "assault-rifles",
  "assault-carbines",
  "bolt-action-rifles",
  "marksman-rifles",
  "submachine-guns",
  "shotguns",
  "machine-guns",
  "grenade-launchers",
  "special-weapons",
] as const;

const WEAPON_MODS = ["weapon-parts-mods"] as const;
const GEAR_PARTS = ["gear-components"] as const;

/** What fits where. Matches the in-game equipment screen: a pistol goes in the holster, not the primary slot. */
export const SLOT_RULES: Readonly<Record<KitSlotKey, SlotRules>> = {
  primary: { item: LONG_GUNS, attachments: WEAPON_MODS, ammo: true },
  secondary: { item: LONG_GUNS, attachments: WEAPON_MODS, ammo: true },
  holster: { item: ["pistols"], attachments: WEAPON_MODS, ammo: true },
  melee: { item: ["melee-weapons"], attachments: [], ammo: false },
  headwear: { item: ["headgear"], attachments: GEAR_PARTS, ammo: false },
  earpiece: { item: ["headsets"], attachments: [], ammo: false },
  faceCover: { item: ["facecovers"], attachments: [], ammo: false },
  eyewear: { item: ["eyewear"], attachments: [], ammo: false },
  armor: { item: ["body-armor"], attachments: GEAR_PARTS, ammo: false },
  rig: { item: ["tactical-rigs"], attachments: GEAR_PARTS, ammo: false },
  backpack: { item: ["backpacks"], attachments: [], ammo: false },
};

/** Ammo for a weapon slot. */
export const AMMO_SLUGS: readonly string[] = ["rounds"];

/**
 * A test for "is this item in any of these categories", for filtering an
 * item search to what fits a slot. Unknown slugs are ignored, so a renamed
 * handbook category narrows the list instead of breaking the page.
 */
export function categoryFilter(
  index: CatalogIndex,
  slugs: readonly string[],
): (itemId: string) => boolean {
  const ids = new Set(slugs.map((slug) => index.idForSlug(slug)).filter((id) => id !== undefined));
  return (itemId) => index.categoriesOfItem(itemId).some((id) => ids.has(id));
}
