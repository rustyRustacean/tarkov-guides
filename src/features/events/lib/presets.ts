import type { CatalogIndex } from "../catalog/catalog-index";
import type {
  ItemStack,
  Kit,
  KitSlotKey,
  Preset,
  PresetRule,
  PresetStat,
  RuleTarget,
} from "../types";

/**
 * Checking a kit against a preset. Pure: the kit, the preset, the catalog's
 * lookups and a way to name things go in; a list of broken rules comes out.
 * Every rule a kit breaks is reported once, with the items that broke it,
 * so the kit page can explain each problem instead of just saying "no".
 */

/** Names for targets and items in messages. */
export interface Namer {
  item: (itemId: string) => string;
  category: (categoryId: string) => string;
}

/** One broken rule. */
export interface Violation {
  ruleId: string;
  message: string;
  /** The items in the kit that broke it (empty for a missing required item). */
  itemIds: string[];
}

/** The result of {@link checkKit}. */
export interface KitCheck {
  ok: boolean;
  violations: Violation[];
}

/** Labels for each limitable stat. */
export const STAT_LABELS: Readonly<Record<PresetStat, string>> = {
  armorClass: "armor class",
  ammoPen: "penetration",
  ammoDamage: "damage",
};

/** Display names for kit slots. */
export const KIT_SLOT_LABELS: Readonly<Record<KitSlotKey, string>> = {
  primary: "Primary weapon",
  secondary: "Secondary weapon",
  holster: "Holster",
  melee: "Melee",
  headwear: "Headwear",
  earpiece: "Headset",
  faceCover: "Face cover",
  eyewear: "Eyewear",
  armor: "Body armor",
  rig: "Rig",
  backpack: "Backpack",
};

/** Every item in a kit with its count, worn and carried, merged by item. */
export function kitContents(kit: Kit): ItemStack[] {
  const counts = new Map<string, number>();
  const add = (itemId: string, qty: number) => {
    counts.set(itemId, (counts.get(itemId) ?? 0) + qty);
  };
  for (const slot of Object.values(kit.slots)) {
    add(slot.itemId, 1);
    for (const attachment of slot.attachments) add(attachment, 1);
    if (slot.ammo) add(slot.ammo.itemId, slot.ammo.qty);
  }
  for (const stack of kit.carried) add(stack.itemId, stack.qty);
  return [...counts].map(([itemId, qty]) => ({ itemId, qty }));
}

/** True when `itemId` is the target item or sits anywhere under the target category. */
export function matchesTarget(target: RuleTarget, itemId: string, index: CatalogIndex): boolean {
  if (target.type === "item") return target.id === itemId;
  return index.categoriesOfItem(itemId).includes(target.id);
}

/** How specific a target is: one item beats any category, and a deeper category beats its parent. */
function specificity(target: RuleTarget, index: CatalogIndex): number {
  return target.type === "item" ? 10_000 : index.depth(target.id) + 1;
}

/** A stat's value for an item, when the catalog has it. */
export function statOf(stat: PresetStat, itemId: string, index: CatalogIndex): number | undefined {
  const record = index.item(itemId);
  if (!record) return undefined;
  if (stat === "armorClass") return record.ac;
  if (stat === "ammoPen") return record.pen;
  return record.dmg;
}

/** A target's display name. */
export function targetName(target: RuleTarget, names: Namer): string {
  return target.type === "item" ? names.item(target.id) : names.category(target.id);
}

function listNames(targets: readonly RuleTarget[], names: Namer): string {
  const labels = targets.map((target) => targetName(target, names));
  if (labels.length <= 1) return labels[0] ?? "nothing";
  return `${labels.slice(0, -1).join(", ")} or ${labels.at(-1) ?? ""}`;
}

function rangeText(min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) return `${String(min)} to ${String(max)}`;
  if (max !== undefined) return `${String(max)} or lower`;
  return `${String(min ?? 0)} or higher`;
}

/** One rule as a sentence, for the preset's summary. */
export function describeRule(rule: PresetRule, names: Namer): string {
  switch (rule.kind) {
    case "ban":
      return `No ${targetName(rule.target, names)}`;
    case "allow":
      return `${targetName(rule.target, names)} allowed`;
    case "allowOnly":
      return `${targetName(rule.scope, names)}: only ${listNames(rule.allowed, names)}`;
    case "cap":
      return rule.max === 0
        ? `No ${targetName(rule.target, names)}`
        : `At most ${String(rule.max)}× ${targetName(rule.target, names)}`;
    case "require":
      return `At least ${String(rule.min)}× ${targetName(rule.target, names)}`;
    case "stat":
      return `${targetName(rule.appliesTo, names)}: ${STAT_LABELS[rule.stat]} ${rangeText(rule.min, rule.max)}`;
  }
}

/**
 * Checks a kit against a preset:
 * - **Bans and exceptions.** For each item, the most specific ban or allow
 *   rule that matches it decides (an item rule beats any category rule, a
 *   deeper category beats its parent). On a tie, the ban wins.
 * - **Allow-only.** An item inside the rule's scope must match one of its
 *   allowed targets.
 * - **Stats.** An item inside the rule's category must have the stat within
 *   range; items without that stat (e.g. a rig with no armor class) pass.
 * - **Caps and requirements** count every matching item in the kit, worn,
 *   attached or carried.
 */
export function checkKit(kit: Kit, preset: Preset, index: CatalogIndex, names: Namer): KitCheck {
  const contents = kitContents(kit);
  const broken = new Map<string, Violation>();
  const flag = (rule: PresetRule, message: string, itemId?: string) => {
    const existing = broken.get(rule.id);
    if (existing) {
      if (itemId && !existing.itemIds.includes(itemId)) existing.itemIds.push(itemId);
      return;
    }
    broken.set(rule.id, { ruleId: rule.id, message, itemIds: itemId ? [itemId] : [] });
  };

  const gates = preset.rules.filter(
    (rule): rule is Extract<PresetRule, { kind: "ban" | "allow" }> =>
      rule.kind === "ban" || rule.kind === "allow",
  );

  for (const { itemId } of contents) {
    let decider: (typeof gates)[number] | null = null;
    let best = -1;
    for (const rule of gates) {
      if (!matchesTarget(rule.target, itemId, index)) continue;
      const score = specificity(rule.target, index);
      if (score > best || (score === best && rule.kind === "ban")) {
        decider = rule;
        best = score;
      }
    }
    if (decider?.kind === "ban") {
      flag(decider, `${targetName(decider.target, names)} isn't allowed`, itemId);
    }

    for (const rule of preset.rules) {
      if (rule.kind === "allowOnly") {
        if (!matchesTarget(rule.scope, itemId, index)) continue;
        if (!rule.allowed.some((target) => matchesTarget(target, itemId, index))) {
          flag(
            rule,
            `${targetName(rule.scope, names)}: only ${listNames(rule.allowed, names)} allowed`,
            itemId,
          );
        }
      } else if (rule.kind === "stat") {
        if (!matchesTarget(rule.appliesTo, itemId, index)) continue;
        const value = statOf(rule.stat, itemId, index);
        if (value === undefined) continue;
        if (
          (rule.min !== undefined && value < rule.min) ||
          (rule.max !== undefined && value > rule.max)
        ) {
          flag(
            rule,
            `${targetName(rule.appliesTo, names)} must have ${STAT_LABELS[rule.stat]} ${rangeText(rule.min, rule.max)}`,
            itemId,
          );
        }
      }
    }
  }

  for (const rule of preset.rules) {
    if (rule.kind !== "cap" && rule.kind !== "require") continue;
    const matching = contents.filter(({ itemId }) => matchesTarget(rule.target, itemId, index));
    const total = matching.reduce((sum, { qty }) => sum + qty, 0);
    const name = targetName(rule.target, names);
    if (rule.kind === "cap" && total > rule.max) {
      flag(
        rule,
        rule.max === 0
          ? `${name} isn't allowed`
          : `At most ${String(rule.max)}× ${name} (this kit has ${String(total)})`,
      );
      const violation = broken.get(rule.id);
      if (violation) violation.itemIds = matching.map(({ itemId }) => itemId);
    }
    if (rule.kind === "require" && total < rule.min) {
      flag(rule, `Needs at least ${String(rule.min)}× ${name} (this kit has ${String(total)})`);
    }
  }

  const order = new Map(preset.rules.map((rule, i) => [rule.id, i]));
  const violations = [...broken.values()].sort(
    (a, b) => (order.get(a.ruleId) ?? 0) - (order.get(b.ruleId) ?? 0),
  );
  return { ok: violations.length === 0, violations };
}
