"use client";

import {
  Activity,
  Crosshair,
  DoorOpen,
  GraduationCap,
  HeartPulse,
  KeyRound,
  Store,
  UtensilsCrossed,
  Warehouse,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import { cn } from "@/shared/ui/lib/cn";

import {
  MODIFIER_CATEGORIES,
  MODIFIER_CLASHES,
  MODIFIER_SEASON,
  SEASONAL_MODIFIERS,
  type ModifierCategory,
  type ModifierKind,
  type SeasonalModifier,
} from "../data/seasonal-modifiers";
import { savePicks, usePicks } from "../lib/modifier-picks-storage";
import { activeClashes, clashPartners, isHighlighted, summarizePoints } from "../lib/modifier-plan";

import { ModifierCard } from "./ModifierCard";

import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const STORAGE_KEY = `tarkovguides.seasonal-modifier-picks.${MODIFIER_SEASON.id}`;

const CATEGORY_ICONS: Readonly<Record<ModifierCategory, LucideIcon>> = {
  stamina: Activity,
  food: UtensilsCrossed,
  health: HeartPulse,
  skills: GraduationCap,
  hideout: Warehouse,
  traders: Store,
  loot: KeyRound,
  combat: Crosshair,
  raids: DoorOpen,
};

const SECTIONS: readonly { kind: ModifierKind; title: string; note: string; band: string }[] = [
  {
    kind: "global",
    title: "Global modifiers",
    note: "Applied to everyone, nothing to pick.",
    band: "via-muted",
  },
  {
    kind: "positive",
    title: "Personal positive",
    note: "Each costs points.",
    band: "via-status-green-soft",
  },
  {
    kind: "negative",
    title: "Personal negative",
    note: "Each gives points.",
    band: "via-status-red-soft",
  },
];

const MODIFIER_IDS: ReadonlySet<string> = new Set(
  SEASONAL_MODIFIERS.filter((modifier) => modifier.kind !== "global").map(
    (modifier) => modifier.id,
  ),
);
const MODIFIERS_BY_ID: ReadonlyMap<string, SeasonalModifier> = new Map(
  SEASONAL_MODIFIERS.map((modifier) => [modifier.id, modifier]),
);
const CATEGORIES_BY_MODIFIER: ReadonlyMap<string, ReadonlySet<ModifierCategory>> = (() => {
  const map = new Map<string, Set<ModifierCategory>>();
  for (const category of MODIFIER_CATEGORIES) {
    for (const id of category.members) {
      const set = map.get(id) ?? new Set<ModifierCategory>();
      set.add(category.id);
      map.set(id, set);
    }
  }
  return map;
})();
const NO_CATEGORIES: ReadonlySet<ModifierCategory> = new Set();

function nameOf(id: string): string {
  return MODIFIERS_BY_ID.get(id)?.name ?? id;
}

function ToggleChip({
  pressed,
  onClick,
  className,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
        pressed
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground hover:bg-accent",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * The Season 2 modifier planner: every modifier as a card like BSG's
 * announcement, click to pick, with the point balance, clashes and
 * category highlights in a side panel. Picks are saved in this browser.
 * Clashes BSG confirmed in Season 1 and our own guesses are always told
 * apart, and guesses can be switched off.
 */
export function SeasonalModifierPlanner() {
  const pickedList = usePicks(STORAGE_KEY, MODIFIER_IDS);
  const picked = useMemo(() => new Set(pickedList), [pickedList]);
  const [categories, setCategories] = useState<ReadonlySet<ModifierCategory>>(NO_CATEGORIES);
  const [showPositive, setShowPositive] = useState(true);
  const [showNegative, setShowNegative] = useState(true);
  const [includeGuesses, setIncludeGuesses] = useState(true);

  const points = summarizePoints(
    pickedList.flatMap((id) => {
      const modifier = MODIFIERS_BY_ID.get(id);
      return modifier ? [modifier] : [];
    }),
  );
  const clashes = activeClashes(picked, MODIFIER_CLASHES, includeGuesses);
  const filter = { categories, showPositive, showNegative };

  function togglePick(id: string): void {
    savePicks(
      STORAGE_KEY,
      picked.has(id) ? pickedList.filter((other) => other !== id) : [...pickedList, id],
    );
  }

  function toggleCategory(id: ModifierCategory): void {
    const next = new Set(categories);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCategories(next);
  }

  const short = points.balance < 0;
  const status = short
    ? { text: `${String(-points.balance)} points short`, className: "text-status-red" }
    : clashes.length > 0
      ? {
          text: `${String(clashes.length)} clash${clashes.length === 1 ? "" : "es"}`,
          className: "text-status-amber",
        }
      : pickedList.length > 0
        ? { text: "Plan works", className: "text-status-green" }
        : { text: "Nothing picked yet", className: "text-muted-foreground" };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 pb-20 lg:grid-cols-[16rem_minmax(0,1fr)] lg:pb-0">
      <aside
        aria-label="Plan and filters"
        className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-[calc(var(--header-height,3.5rem)+1rem)] lg:max-h-[calc(100dvh-var(--header-height,3.5rem)-2rem)] lg:overflow-y-auto lg:pr-1"
      >
        <section
          aria-labelledby="planner-points"
          className="border-border bg-card rounded-lg border p-4"
        >
          <h2 id="planner-points" className="font-display text-lg font-semibold">
            Your points
          </h2>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-1 text-sm tabular-nums">
            <dt className="text-muted-foreground">Gained</dt>
            <dd className="text-status-green text-right">
              {points.gained > 0 ? `+${String(points.gained)}` : "0"}
            </dd>
            <dt className="text-muted-foreground">Spent</dt>
            <dd className="text-status-red text-right">
              {points.spent > 0 ? `-${String(points.spent)}` : "0"}
            </dd>
            <dt className="font-medium">Balance</dt>
            <dd className="text-right text-lg font-semibold">{points.balance}</dd>
          </dl>
          <p aria-live="polite" className={cn("mt-2 text-sm font-medium", status.className)}>
            {status.text}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Starts at 0. Negative modifiers give the points positive ones cost.
          </p>
          {pickedList.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => {
                savePicks(STORAGE_KEY, []);
              }}
            >
              Clear {pickedList.length} pick{pickedList.length === 1 ? "" : "s"}
            </Button>
          )}
        </section>

        <section aria-labelledby="planner-highlight" className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h2 id="planner-highlight" className="text-sm font-semibold">
              Highlight
            </h2>
            {categories.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  setCategories(NO_CATEGORIES);
                }}
                className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Positive or negative">
            <ToggleChip
              pressed={showPositive}
              onClick={() => {
                setShowPositive(!showPositive);
              }}
              className={showPositive ? "border-status-green bg-status-green-soft" : ""}
            >
              Positive
            </ToggleChip>
            <ToggleChip
              pressed={showNegative}
              onClick={() => {
                setShowNegative(!showNegative);
              }}
              className={showNegative ? "border-status-red bg-status-red-soft" : ""}
            >
              Negative
            </ToggleChip>
          </div>
          <div
            className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
            role="group"
            aria-label="Categories"
          >
            {MODIFIER_CATEGORIES.map((category) => {
              const Icon = CATEGORY_ICONS[category.id];
              return (
                <ToggleChip
                  key={category.id}
                  pressed={categories.has(category.id)}
                  onClick={() => {
                    toggleCategory(category.id);
                  }}
                  className="shrink-0"
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 whitespace-nowrap">{category.label}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {category.members.length}
                  </span>
                </ToggleChip>
              );
            })}
          </div>
        </section>

        <section
          aria-labelledby="planner-clashes"
          className="border-border bg-card rounded-lg border p-4"
        >
          <h2 id="planner-clashes" className="text-sm font-semibold">
            Clashes in your picks
          </h2>
          <label className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
            <Checkbox
              checked={includeGuesses}
              onChange={(event) => {
                setIncludeGuesses(event.target.checked);
              }}
            />
            Include our guesses
          </label>
          {clashes.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-sm">None of your picks clash.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {clashes.map((clash) => (
                <li key={`${clash.a}:${clash.b}`} className="flex flex-col">
                  <span>
                    {nameOf(clash.a)} and {nameOf(clash.b)}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      clash.source === "season1" ? "text-status-red" : "text-status-amber",
                    )}
                  >
                    {clash.source === "season1" ? "Confirmed in Season 1" : "Our guess"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      <div className="flex min-w-0 flex-col gap-8">
        <p className="text-muted-foreground text-sm">
          Click a positive or negative modifier to pick it. Values are from BSG&apos;s Season 2
          announcement and may change before the season starts.
        </p>

        {SECTIONS.map((section) => (
          <section key={section.kind} aria-labelledby={`modifiers-${section.kind}`}>
            <div
              className={cn(
                "mb-3 bg-linear-to-r from-transparent to-transparent py-1.5 text-center",
                section.band,
              )}
            >
              <h2
                id={`modifiers-${section.kind}`}
                className="font-display text-lg font-semibold tracking-[0.25em] uppercase"
              >
                {section.title}
              </h2>
              <p className="text-muted-foreground text-xs">{section.note}</p>
            </div>
            {/* Three columns only from 2xl: below that, with the side panel, the
                cards get too narrow for BSG's wide card shape. */}
            <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
              {SEASONAL_MODIFIERS.filter((modifier) => modifier.kind === section.kind).map(
                (modifier) => {
                  const partners = clashPartners(modifier.id, MODIFIER_CLASHES, includeGuesses)
                    .filter((partner) => picked.has(partner.id))
                    .map((partner) => ({
                      name: nameOf(partner.id),
                      guess: partner.clash.source === "guess",
                    }));
                  return (
                    <ModifierCard
                      key={modifier.id}
                      modifier={modifier}
                      picked={picked.has(modifier.id)}
                      highlighted={isHighlighted(
                        modifier,
                        CATEGORIES_BY_MODIFIER.get(modifier.id) ?? NO_CATEGORIES,
                        filter,
                      )}
                      clashes={partners}
                      {...(modifier.kind === "global"
                        ? {}
                        : {
                            onToggle: () => {
                              togglePick(modifier.id);
                            },
                          })}
                    />
                  );
                },
              )}
            </div>
          </section>
        ))}

        <ClashReference />
      </div>

      <div className="border-border bg-background/95 fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t px-[max(1rem,env(safe-area-inset-left,0px))] pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] backdrop-blur-md lg:hidden">
        <span className="text-sm tabular-nums">
          Balance <span className="font-semibold">{points.balance}</span>
        </span>
        <span className={cn("text-sm font-medium", status.className)}>{status.text}</span>
      </div>
    </div>
  );
}

/** Every known clash, confirmed and guessed in separate lists, guesses with their reasoning. */
function ClashReference() {
  const confirmed = MODIFIER_CLASHES.filter((clash) => clash.source === "season1");
  const guessed = MODIFIER_CLASHES.filter((clash) => clash.source === "guess");
  return (
    <section
      aria-labelledby="clash-reference"
      className="border-border bg-card rounded-lg border p-5"
    >
      <h2 id="clash-reference" className="font-display text-xl font-semibold">
        Which modifiers clash
      </h2>
      <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
        BSG hasn&apos;t published Season 2&apos;s clashes yet. The first list is pairs BSG blocked
        in Season 1 that are both back this season. The second is our own guesswork and could be
        wrong.
      </p>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <h3 className="text-status-red text-sm font-semibold">
            Confirmed in Season 1 ({confirmed.length})
          </h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {confirmed.map((clash) => (
              <li key={`${clash.a}:${clash.b}`}>
                {nameOf(clash.a)} and {nameOf(clash.b)}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-status-amber text-sm font-semibold">
            Our guesses ({guessed.length})
          </h3>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {guessed.map((clash) => (
              <li key={`${clash.a}:${clash.b}`}>
                {nameOf(clash.a)} and {nameOf(clash.b)}
                {clash.reason && (
                  <span className="text-muted-foreground block text-xs">{clash.reason}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
