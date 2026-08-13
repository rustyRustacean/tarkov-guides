import ammoJson from "./ammo.json";
import armorJson from "./armor.json";
import platesJson from "./plates.json";
import rigsJson from "./rigs.json";

import type { AmmoEntry, ArmorEntry, PlateEntry, RigEntry } from "./ballistics-types";

/**
 * Curated ballistics reference data, copied verbatim from
 * `old/tarkov-tips/src/data/{ammo,armor,plates,rigs}.json`. Not covered
 * by the live tarkov.dev GraphQL query ported in `shared/lib/tarkov-api`
 * (that query doesn't select ammo/armor stat fields), and small enough
 * (~137KB total) to bundle directly rather than fetch. No consumer exists
 * yet; it's cheap to port now and establishes the static-JSON-plus-typed-
 * loader pattern this folder is meant to hold.
 */
export const AMMO_ITEMS = (ammoJson as { data: { items: readonly AmmoEntry[] } }).data.items;
export const ARMOR_ITEMS = (armorJson as { data: { items: readonly ArmorEntry[] } }).data.items;
export const PLATE_ITEMS = (platesJson as { data: { items: readonly PlateEntry[] } }).data.items;
export const RIG_ITEMS = (rigsJson as { data: { items: readonly RigEntry[] } }).data.items;
