import type { ModifierCategory, ModifierClash, SeasonalModifier } from "../data/seasonal-modifiers";

/** The point totals for a set of picks. */
export interface PointSummary {
  /** Points the picked negative modifiers give. */
  gained: number;
  /** Points the picked positive modifiers cost, as a positive number. */
  spent: number;
  /** `gained - spent`. The plan only works at 0 or above, since every character starts at 0. */
  balance: number;
}

/** Adds up the picked modifiers' points. Global modifiers are worth nothing either way. */
export function summarizePoints(picked: readonly SeasonalModifier[]): PointSummary {
  let gained = 0;
  let spent = 0;
  for (const modifier of picked) {
    if (modifier.points > 0) gained += modifier.points;
    else spent -= modifier.points;
  }
  return { gained, spent, balance: gained - spent };
}

/** The clashes that apply right now: every listed pair whose two modifiers are both picked. */
export function activeClashes(
  pickedIds: ReadonlySet<string>,
  clashes: readonly ModifierClash[],
  includeGuesses: boolean,
): readonly ModifierClash[] {
  return clashes.filter(
    (clash) =>
      (includeGuesses || clash.source === "season1") &&
      pickedIds.has(clash.a) &&
      pickedIds.has(clash.b),
  );
}

/** The other side of every clash involving `id`. */
export function clashPartners(
  id: string,
  clashes: readonly ModifierClash[],
  includeGuesses: boolean,
): readonly { id: string; clash: ModifierClash }[] {
  return clashes.flatMap((clash) => {
    if (!includeGuesses && clash.source === "guess") return [];
    if (clash.a === id) return [{ id: clash.b, clash }];
    if (clash.b === id) return [{ id: clash.a, clash }];
    return [];
  });
}

/** What the reader is currently highlighting. */
export interface HighlightFilter {
  /** Highlighted categories; empty means no category highlight. */
  categories: ReadonlySet<ModifierCategory>;
  showPositive: boolean;
  showNegative: boolean;
}

/**
 * Whether a card stays at full opacity. With no category picked every card
 * matches; otherwise a card must belong to one of the picked categories.
 * The positive and negative toggles then narrow the personal modifiers;
 * global ones follow the categories only, since they're neither.
 */
export function isHighlighted(
  modifier: SeasonalModifier,
  modifierCategories: ReadonlySet<ModifierCategory>,
  filter: HighlightFilter,
): boolean {
  if (modifier.kind === "positive" && !filter.showPositive) return false;
  if (modifier.kind === "negative" && !filter.showNegative) return false;
  if (filter.categories.size === 0) return true;
  for (const category of filter.categories) {
    if (modifierCategories.has(category)) return true;
  }
  return false;
}

/** BSG's points label: "(-2)" for a cost, "(+3)" for a gain. */
export function formatModifierPoints(points: number): string {
  return points > 0 ? `(+${String(points)})` : `(${String(points)})`;
}

/** A plan's gained total, "+11", or a plain "0". */
export function formatGained(gained: number): string {
  return gained > 0 ? `+${String(gained)}` : "0";
}

/** A plan's spent total, "-8", or a plain "0". */
export function formatSpent(spent: number): string {
  return spent > 0 ? `-${String(spent)}` : "0";
}

/** How a clash's source is named: in full on its own line, short after a modifier name. */
export const CLASH_SOURCE_LABELS: Readonly<
  Record<ModifierClash["source"], { long: string; short: string }>
> = {
  season1: { long: "Confirmed in Season 1", short: "Season 1" },
  guess: { long: "Our guess", short: "our guess" },
};

export type PlanStatusTone = "red" | "amber" | "green" | "muted";

/** One line on how the plan stands, shown under the points and on the PNG. */
export interface PlanStatus {
  text: string;
  tone: PlanStatusTone;
}

/** Being short of points matters most, then clashes. */
export function planStatus(
  points: PointSummary,
  clashCount: number,
  pickCount: number,
): PlanStatus {
  if (points.balance < 0) return { text: `${String(-points.balance)} points short`, tone: "red" };
  if (clashCount > 0) {
    return { text: `${String(clashCount)} clash${clashCount === 1 ? "" : "es"}`, tone: "amber" };
  }
  if (pickCount > 0) return { text: "Plan works", tone: "green" };
  return { text: "Nothing picked yet", tone: "muted" };
}
