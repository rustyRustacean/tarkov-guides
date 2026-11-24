import { cleanText } from "./clean-text";

import type {
  CategoryTarget,
  ItemStack,
  Kit,
  KitSlot,
  KitSlotKey,
  Preset,
  PresetRule,
  PresetStat,
  RuleTarget,
} from "../types";

/**
 * Runtime validation for presets and kits, which arrive from event rooms,
 * shared links and imports: all untrusted. Same rule as the event schema:
 * keep what's valid, drop what isn't, per rule or per item.
 */

/** Size limits for presets and kits. */
export const PRESET_LIMITS = {
  name: 40,
  description: 300,
  note: 120,
  rules: 60,
  allowed: 50,
  carried: 60,
  attachments: 40,
  maxQty: 999,
  maxStat: 1000,
} as const;

/** Every kit slot, in the in-game equipment screen's order. */
export const KIT_SLOT_KEYS: readonly KitSlotKey[] = [
  "primary",
  "secondary",
  "holster",
  "melee",
  "headwear",
  "earpiece",
  "faceCover",
  "eyewear",
  "armor",
  "rig",
  "backpack",
];

const STATS: ReadonlySet<string> = new Set<PresetStat>(["armorClass", "ammoPen", "ammoDamage"]);
const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function intIn(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : null;
}

function numberIn(value: unknown, min: number, max: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;
}

/** Parses a rule target, or `null`. */
export function parseTarget(value: unknown): RuleTarget | null {
  if (!isRecord(value) || !isId(value.id)) return null;
  if (value.type === "category") return { type: "category", id: value.id };
  if (value.type === "item") return { type: "item", id: value.id };
  return null;
}

function parseCategoryTarget(value: unknown): CategoryTarget | null {
  const target = parseTarget(value);
  return target?.type === "category" ? target : null;
}

/** Parses one rule, or `null` when it's malformed or can never match anything. */
export function parseRule(value: unknown): PresetRule | null {
  if (!isRecord(value) || !isId(value.id)) return null;
  const note = cleanText(value.note, PRESET_LIMITS.note);
  const base = note ? { id: value.id, note } : { id: value.id };

  switch (value.kind) {
    case "ban":
    case "allow": {
      const target = parseTarget(value.target);
      return target ? { ...base, kind: value.kind, target } : null;
    }
    case "allowOnly": {
      const scope = parseCategoryTarget(value.scope);
      const allowed = (Array.isArray(value.allowed) ? value.allowed : [])
        .map(parseTarget)
        .filter((target): target is RuleTarget => target !== null)
        .slice(0, PRESET_LIMITS.allowed);
      return scope ? { ...base, kind: "allowOnly", scope, allowed } : null;
    }
    case "cap": {
      const target = parseTarget(value.target);
      const max = intIn(value.max, 0, PRESET_LIMITS.maxQty);
      return target && max !== null ? { ...base, kind: "cap", target, max } : null;
    }
    case "require": {
      const target = parseTarget(value.target);
      const min = intIn(value.min, 1, PRESET_LIMITS.maxQty);
      return target && min !== null ? { ...base, kind: "require", target, min } : null;
    }
    case "stat": {
      const appliesTo = parseCategoryTarget(value.appliesTo);
      if (!appliesTo || typeof value.stat !== "string" || !STATS.has(value.stat)) return null;
      const min = numberIn(value.min, 0, PRESET_LIMITS.maxStat);
      const max = numberIn(value.max, 0, PRESET_LIMITS.maxStat);
      if (min === undefined && max === undefined) return null;
      return {
        ...base,
        kind: "stat",
        stat: value.stat as PresetStat,
        appliesTo,
        ...(min === undefined ? {} : { min }),
        ...(max === undefined ? {} : { max }),
      };
    }
    default:
      return null;
  }
}

/** Parses a preset, or `null` when it has no usable id or name. */
export function parsePreset(value: unknown): Preset | null {
  if (!isRecord(value) || !isId(value.id)) return null;
  const name = cleanText(value.name, PRESET_LIMITS.name);
  if (!name) return null;
  const seen = new Set<string>();
  const rules: PresetRule[] = [];
  for (const raw of Array.isArray(value.rules) ? value.rules : []) {
    const rule = parseRule(raw);
    if (!rule || seen.has(rule.id)) continue;
    seen.add(rule.id);
    rules.push(rule);
    if (rules.length >= PRESET_LIMITS.rules) break;
  }
  return {
    id: value.id,
    name,
    description: cleanText(value.description, PRESET_LIMITS.description),
    rules,
  };
}

function parseStack(value: unknown): ItemStack | null {
  if (!isRecord(value) || !isId(value.itemId)) return null;
  const qty = intIn(value.qty, 1, PRESET_LIMITS.maxQty);
  return qty === null ? null : { itemId: value.itemId, qty };
}

function parseSlot(value: unknown): KitSlot | null {
  if (!isRecord(value) || !isId(value.itemId)) return null;
  const attachments = (Array.isArray(value.attachments) ? value.attachments : [])
    .filter(isId)
    .slice(0, PRESET_LIMITS.attachments);
  const slot: KitSlot = { itemId: value.itemId, attachments };
  const ammo = parseStack(value.ammo);
  if (ammo) slot.ammo = ammo;
  return slot;
}

/** Parses a kit, dropping anything malformed. Never `null`: an unreadable kit is just empty. */
export function parseKit(value: unknown): Kit {
  const kit: Kit = { slots: {}, carried: [] };
  if (!isRecord(value)) return kit;
  const slots = isRecord(value.slots) ? value.slots : {};
  for (const key of KIT_SLOT_KEYS) {
    const slot = parseSlot(slots[key]);
    if (slot) kit.slots[key] = slot;
  }
  kit.carried = (Array.isArray(value.carried) ? value.carried : [])
    .map(parseStack)
    .filter((stack): stack is ItemStack => stack !== null)
    .slice(0, PRESET_LIMITS.carried);
  return kit;
}

/** An empty kit. */
export function emptyKit(): Kit {
  return { slots: {}, carried: [] };
}
