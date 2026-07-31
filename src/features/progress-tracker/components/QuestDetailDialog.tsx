"use client";

import { LayoutGrid, List, TrendingUp, Zap } from "lucide-react";
import { useMemo, useState } from "react";

import { QUEST_GUIDE_IMAGES } from "@/shared/data/quest-guide-images";
import { isMoneyItem } from "@/shared/lib/flea-market/item-predicates";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";

import { useActiveFaction } from "../hooks/use-active-faction";
import { useTaskActions } from "../hooks/use-task-actions";
import {
  estimateSectionWeight,
  selectFeaturedSectionIndex,
  TILE_PER_LINE_OVERHEAD,
} from "../lib/quest-detail-bento";
import {
  formatTraderRequirement,
  getQuestAvailability,
  getQuestDependents,
} from "../selectors/quest-availability";
import { useProgressTrackerStore } from "../store";

import { statusBadge } from "./QuestCard";
import { QuestGuideImageLightbox } from "./QuestGuideImageLightbox";

import type { QuestAvailability } from "../selectors/quest-availability";
import type { QuestGuideImage } from "@/shared/data/quest-guide-images";
import type { NormalizedTask, RawFinishRewards } from "@/shared/lib/tarkov-api/types";
import type { ReactNode } from "react";

export interface QuestDetailDialogProps {
  /** `null` closes the dialog. */
  taskId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Lets the caller re-target the dialog at a prerequisite/dependent quest without closing it. */
  onSelectTask: (taskId: string) => void;
}

interface BentoSection {
  id: string;
  title: string;
  weight: number;
  content: ReactNode;
  /** Extra control rendered next to the title itself (e.g. `RewardViewToggle`) - absent for every section that doesn't need one. */
  headerAction?: ReactNode;
}

/**
 * `true` when a `RawFinishRewards` object actually has anything to show.
 * Real tarkov.dev data confirmed via a live browser check: a task's
 * `startRewards`/`failureOutcome` can be a non-null object with every field
 * an empty array (i.e. "no starting reward," not `null`) - gating a whole
 * section (including its heading) on mere object presence rendered an empty
 * "Starting rewards" heading with nothing under it for e.g. the real
 * "Debut" task. Callers must gate on this, not on `rewards !== null` alone.
 */
function hasRewardContent(rewards: RawFinishRewards): boolean {
  return (
    rewards.items.length > 0 ||
    rewards.traderStanding.length > 0 ||
    rewards.traderUnlock.length > 0 ||
    rewards.offerUnlock.length > 0 ||
    rewards.skillLevelReward.length > 0
  );
}

interface RewardEntry {
  key: string;
  /** 40px icon; `null` renders the icon-less placeholder chip (currently only `skillLevelReward`, which has no icon field anywhere in the API). */
  iconLink: string | null;
  /** `true` for the two trader-logo buckets (`traderStanding`/`traderUnlock`) - rendered as a circular portrait (`rounded-full object-cover`), matching `QuestTreeView.tsx`'s trader-lane-header convention, instead of the item buckets' plain square `object-contain`. */
  traderPortrait: boolean;
  /** Full-precision text - always what list mode and the weight estimate use. */
  label: string;
  /** Card/tile-mode-only override of `label` (`null` when the full label is fine at tile width) - currently only set for money, whose full comma-grouped amount ("13,000₽") was confirmed via a live check to genuinely overflow-clip inside a narrow tile column by a couple px. List mode intentionally never reads this - it has the room for the real, precise figure. */
  cardLabel: string | null;
  caption: string | null;
  /** Corner-badge quantity text (e.g. `"×2"`) - set only when count > 1; a bare "×1" is noise. Always `null` for money (see `formatMoneyAmount`) - the formatted amount already carries the count, and a 5-6 digit rouble amount doesn't fit a small corner badge anyway. */
  badge: string | null;
}

/** Tarkov.dev `shortName` -> currency symbol, for `formatMoneyAmount`/`abbreviateMoneyAmount`. */
const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = { rub: "₽", usd: "$", eur: "€" };

/**
 * A quest's money reward is always some non-trivial multiple (Roubles counts
 * routinely run 5-6 digits), unlike a stackable item reward where "×2" vs
 * "×1" is the interesting distinction - so money gets its own formatted
 * amount as the entry's primary label (e.g. "15,000₽") instead of the
 * generic item-shortName-plus-corner-badge treatment every other item
 * reward uses. Full precision - this is `RewardEntry.label`, not
 * `.cardLabel`; see `abbreviateMoneyAmount` for the space-constrained
 * tile-only form.
 */
function formatMoneyAmount(shortName: string, count: number): string {
  const symbol = CURRENCY_SYMBOLS[shortName.toLowerCase()] ?? "";
  return `${count.toLocaleString()}${symbol}`;
}

/**
 * Compact "15K₽"/"1.2M₽" form for a money reward - confirmed via a live
 * check that even a plain 5-digit amount like "13,000₽" genuinely
 * overflow-clips inside a 4-column tile grid's narrow columns (a couple px
 * over, not a rounding fluke), so the full comma-grouped form from
 * `formatMoneyAmount` isn't usable as a tile's primary (large, prominent)
 * label the way it is in a full-width list row. One decimal place only
 * when the amount isn't a round thousand/million, to keep it short.
 */
function abbreviateMoneyAmount(shortName: string, count: number): string {
  const symbol = CURRENCY_SYMBOLS[shortName.toLowerCase()] ?? "";
  if (count >= 1_000_000) {
    const millions = count / 1_000_000;
    return `${Number.isInteger(millions) ? String(millions) : millions.toFixed(1)}M${symbol}`;
  }
  if (count >= 1_000) {
    const thousands = count / 1_000;
    return `${Number.isInteger(thousands) ? String(thousands) : thousands.toFixed(1)}K${symbol}`;
  }
  return `${count.toLocaleString()}${symbol}`;
}

/**
 * Flattens every field of a `RawFinishRewards` object into one tile entry
 * per reward, the single source both `RewardDisplay` (the actual rendered
 * grid/list) and `formatRewardWeightLines` (the bento-grid weight estimate) build
 * from - both always agree on exactly which entries a reward section
 * "contains," even though each formats that shared data differently for its
 * own purpose (short tile label vs. a flatter weight-estimate string).
 */
function buildRewardEntries(rewards: RawFinishRewards): RewardEntry[] {
  const entries: RewardEntry[] = [];
  rewards.items.forEach((entry, index) => {
    // `RawFinishRewardItem.item` has no `types` field (unlike the catalog
    // item shape `isMoneyItem` was written against) - passing `types: []`
    // is safe/correct since it just falls through to `isMoneyItem`'s own
    // `shortName` fallback check, which every real money reward matches.
    const isMoney = isMoneyItem({ types: [], shortName: entry.item.shortName });
    entries.push({
      key: `item-${String(index)}`,
      iconLink: entry.item.iconLink,
      traderPortrait: false,
      label: isMoney ? formatMoneyAmount(entry.item.shortName, entry.count) : entry.item.shortName,
      cardLabel: isMoney ? abbreviateMoneyAmount(entry.item.shortName, entry.count) : null,
      caption: null,
      badge: !isMoney && entry.count > 1 ? `×${String(entry.count)}` : null,
    });
  });
  rewards.traderStanding.forEach((entry, index) => {
    entries.push({
      key: `standing-${String(index)}`,
      iconLink: entry.trader.imageLink,
      traderPortrait: true,
      label: entry.trader.name,
      cardLabel: null,
      caption: `${entry.standing > 0 ? "+" : ""}${String(entry.standing)}`,
      badge: null,
    });
  });
  rewards.traderUnlock.forEach((entry, index) => {
    entries.push({
      key: `unlock-${String(index)}`,
      iconLink: entry.trader.imageLink,
      traderPortrait: true,
      label: entry.trader.name,
      cardLabel: null,
      caption: "Unlocked",
      badge: null,
    });
  });
  rewards.offerUnlock.forEach((entry, index) => {
    entries.push({
      key: `offer-${String(index)}`,
      iconLink: entry.item.iconLink,
      traderPortrait: false,
      label: entry.item.shortName,
      cardLabel: null,
      caption: `${entry.trader.name} LL${String(entry.level)}`,
      badge: null,
    });
  });
  rewards.skillLevelReward.forEach((entry, index) => {
    entries.push({
      key: `skill-${String(index)}`,
      iconLink: null,
      traderPortrait: false,
      label: entry.name,
      cardLabel: null,
      caption: `+${String(entry.level)}`,
      badge: null,
    });
  });
  return entries;
}

/** One entry's plain-text form (`"label caption badge"`, skipping empty parts) - shared by the weight estimate and the bullet-list view mode so all three (grid, list, weight) always agree on what an entry "says." */
function formatRewardEntryLine(entry: RewardEntry): string {
  return `${entry.label}${entry.caption ? ` ${entry.caption}` : ""}${entry.badge ? ` ${entry.badge}` : ""}`;
}

/** Weight-estimate-only text form, derived from the same entries `RewardDisplay` renders - so the estimate can't silently disagree with what actually exists in a section. */
function formatRewardWeightLines(rewards: RawFinishRewards): string[] {
  return buildRewardEntries(rewards).map(formatRewardEntryLine);
}

export type RewardViewMode = "cards" | "list";

/**
 * Renders a reward section's entries either as a grid of icon tiles (large
 * icon, short label, optional caption/corner-quantity-badge - large icons
 * and shortened labels, `.shortName` not the full item name, read more like
 * Tarkov's own inventory UI and stay scannable even when a section has 6-8
 * rewards) or as a plain bullet list (`RewardViewToggle` in each reward
 * section's own header switches between the two, one shared mode across
 * every reward section in the dialog). Tile mode is deliberately NOT
 * interactive (no `<button>`/hover state) - unlike `KappaItemCard.tsx`'s
 * similar icon-tile convention, nothing here is clickable.
 */
function RewardDisplay({
  rewards,
  viewMode,
}: {
  rewards: RawFinishRewards;
  viewMode: RewardViewMode;
}) {
  const entries = buildRewardEntries(rewards);
  if (entries.length === 0) return null;

  if (viewMode === "list") {
    return (
      <ul className="marker:text-muted-foreground mt-1 flex list-outside list-disc flex-col gap-1 pl-4">
        {entries.map((entry) => (
          <li key={entry.key}>{formatRewardEntryLine(entry)}</li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {entries.map((entry) => (
        <li
          key={entry.key}
          // `justify-center` (not the flex default `justify-start`) matters
          // here specifically because the grid row stretches every tile in
          // it to the tallest sibling's height (CSS Grid's default
          // `align-items: stretch`) - a two-line entry (icon + label +
          // caption, e.g. a trader-standing reward) and a one-line entry
          // (icon + label only, e.g. a money reward with no caption) then
          // occupy the same cell height. Top-aligned content left the
          // shorter entry's extra space stranded below it as a lopsided gap;
          // centering distributes it evenly above/below instead, so a
          // one-line tile doesn't read as visually broken next to its
          // two-line neighbors.
          className="bg-background relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-md p-2 text-center"
        >
          {entry.badge && (
            <span
              aria-hidden="true"
              className="bg-status-amber absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold text-black shadow-sm"
            >
              {entry.badge}
            </span>
          )}
          {entry.iconLink ? (
            // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon, not a local/optimizable asset.
            <img
              src={entry.iconLink}
              alt=""
              className={
                entry.traderPortrait
                  ? "h-10 w-10 rounded-full object-cover"
                  : "h-10 w-10 object-contain"
              }
            />
          ) : (
            <span
              aria-hidden="true"
              className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full"
            >
              <TrendingUp className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          {/* `w-full` is load-bearing here, not decorative - the parent
              `<li>` is a `flex flex-col items-center` column, so without an
              explicit width these spans size to their own text content
              (`items-center`'s cross-axis default) and `truncate`'s
              `overflow-hidden` never has anything to actually clip,
              confirmed via a live check: a long reward name like "Mosin
              Infantry Default" rendered at full width and visually bled
              into the next grid tile instead of ellipsizing. */}
          <span className="w-full truncate text-xs font-medium">
            {entry.cardLabel ?? entry.label}
          </span>
          {entry.caption && (
            <span className="text-muted-foreground w-full truncate text-[11px]">
              {entry.caption}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Small icon-only toggle, rendered in the header of every reward-bearing
 * bento section (Starting rewards/Rewards/If this task fails) - all three
 * share the same `mode`/`onToggle` from the parent, so switching from any
 * one of them keeps every reward section in the dialog in sync rather than
 * letting them drift into a mismatched mix of list/card sections.
 */
function RewardViewToggle({ mode, onToggle }: { mode: RewardViewMode; onToggle: () => void }) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={onToggle}
      aria-label={mode === "cards" ? "Switch to list view" : "Switch to grid view"}
      title={mode === "cards" ? "Switch to list view" : "Switch to grid view"}
      className="h-6 w-6"
    >
      {mode === "cards" ? <List className="h-3.5 w-3.5" /> : <LayoutGrid className="h-3.5 w-3.5" />}
    </Button>
  );
}

/**
 * Expandable "wiki guide images" toggle for a quest's Objectives card -
 * collapsed by default, same interaction shape as `ItemRow.tsx`'s
 * `ItemLocationHint` (`ITEM_LOCATIONS`'s own expand-on-demand convention).
 * Only ever rendered when a curated `QUEST_GUIDE_IMAGES` entry exists for
 * the task (see the call site) - a quest with no curated screenshots shows
 * no toggle at all rather than an empty one.
 *
 * Clicking a thumbnail opens `QuestGuideImageLightbox` at that image's
 * index (rather than the previous behavior of opening the same scaled
 * thumbnail URL in a new tab) - mirrors the EFT wiki's own image-gallery
 * lightbox: full resolution, and prev/next through every curated image for
 * this task without leaving the page.
 */
function ObjectiveGuideImages({ images }: { images: readonly QuestGuideImage[] }) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  return (
    <div className="mt-2">
      <button
        type="button"
        className="text-muted-foreground text-xs underline-offset-2 hover:underline"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded((current) => !current);
        }}
      >
        {expanded ? "Hide" : "Show"} wiki guide images {expanded ? "▲" : "▼"}
      </button>
      {expanded && (
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {images.map((image, index) => (
            // Static, never-reordered list rendered fresh from the curated
            // data each time - index is a stable-enough key here.
            <button
              key={index}
              type="button"
              onClick={() => {
                setLightboxIndex(index);
              }}
              className="text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- external wiki-hosted screenshot, not a local/optimizable asset. */}
              <img
                src={image.src}
                alt={image.caption}
                loading="lazy"
                // Confirmed via a live check: Fandom's image CDN 404s any
                // request that carries a `Referer` header from a
                // non-Fandom origin (real anti-hotlink protection, not a
                // Cloudflare/bot-detection issue like the wiki page itself)
                // - a plain `<img>` here would 404 in every real browser
                // even though it loads fine with no referrer at all (e.g.
                // direct navigation, or curl without `-H Referer`).
                referrerPolicy="no-referrer"
                className="h-24 w-full rounded-md object-cover"
              />
              {image.caption && (
                <span className="text-muted-foreground mt-1 block truncate text-[11px]">
                  {image.caption}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <QuestGuideImageLightbox
        images={images}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
      />
    </div>
  );
}

/**
 * The trader/level/Kappa/Lightkeeper/status badge row, shared by both places
 * `QuestDetailDialog`'s heading can render: `overlaid` (the badges sit on top
 * of the hero photo, `PhotoFeatureCard`-style) swaps every badge's own subtle
 * tinted background - only legible against the page's own flat surface, not
 * a busy photo underneath - for the same `bg-background/70 backdrop-blur-sm`
 * chip treatment the homepage's own photo-card tags use, while leaving each
 * variant's text color (the part that actually carries meaning: amber for
 * "Available," the Kappa gold, etc.) untouched.
 */
function TaskBadges({
  task,
  availability,
  overlaid,
}: {
  task: NormalizedTask;
  availability: QuestAvailability | undefined;
  overlaid: boolean;
}) {
  const chipClassName = overlaid ? "bg-background/70 backdrop-blur-sm" : undefined;
  return (
    <>
      <Badge variant="outline" className={chipClassName}>
        {task.trader.name}
      </Badge>
      <Badge variant="outline" className={chipClassName}>
        Level {task.minPlayerLevel}
      </Badge>
      {task.kappaRequired && (
        <Badge variant="kappa" className={chipClassName}>
          Kappa
        </Badge>
      )}
      {task.lightkeeperRequired && (
        <Badge variant="outline" className={chipClassName}>
          Lightkeeper
        </Badge>
      )}
      {availability &&
        (() => {
          const badge = statusBadge(task, availability);
          return (
            <Badge variant={badge.variant} className={chipClassName}>
              {badge.label}
            </Badge>
          );
        })()}
    </>
  );
}

/**
 * Full detail view for one task: objectives, item requirements, rewards,
 * prerequisites/unlocks (both id-based via `taskRequirements`/
 * `getQuestDependents`, never a persisted names-based field), trader-loyalty
 * gates, wiki link, and the same status actions `QuestCard` exposes. Reads
 * its own data (live game data + active profile) the same way
 * `CharacterStatsDialog` does, so callers only need to pass a `taskId`.
 *
 * A full-width hero image (`task.taskImageLink`) leads the dialog when one
 * exists, breaking out of `DialogContent`'s own padding via a negative
 * margin rather than touching the shared `Dialog.tsx` (used by 8 other
 * dialogs) - the title and trader/level/Kappa/status badges (`TaskBadges`)
 * sit overlaid on it via a bottom gradient scrim, `PhotoFeatureCard`-style
 * (the homepage's own photo cards), rather than floating in plain text below
 * it. A task with no hero image falls back to a plain `DialogHeader` with
 * the same badge row underneath instead. Every section below renders as its
 * own visually-distinct card in a 2-column bento grid instead of a flat
 * stack of bare headings - when the number of populated sections is odd,
 * the single largest one (`selectFeaturedSectionIndex`, weighted by
 * `estimateSectionWeight`) spans both columns so the grid still tiles
 * evenly.
 */
export function QuestDetailDialog({ taskId, onOpenChange, onSelectTask }: QuestDetailDialogProps) {
  const { data } = useTarkovGameData();
  // Read `data?.tasks` directly as the dependency (not `data?.tasks ?? []`
  // - see `hooks/use-task-actions.ts`'s comment for why the fallback needs
  // to live inside the memoized callback, not the dependency expression.
  const tasksData = data?.tasks;
  const tasks = tasksData ?? [];
  const tasksById = useMemo(
    () => new Map((tasksData ?? []).map((task) => [task.id, task])),
    [tasksData],
  );

  const progress = useProgressTrackerStore((state) =>
    state.activeProfileId !== null ? state.progressByProfile[state.activeProfileId] : undefined,
  );
  const activeFaction = useActiveFaction();
  const pinnedTaskIds = progress?.pinnedTaskIds ?? [];
  const togglePinnedTask = useProgressTrackerStore((state) => state.togglePinnedTask);
  const { startTask, doneTask, failTask, undoTask } = useTaskActions();
  // One shared mode across every reward-bearing section in the dialog
  // (Starting rewards/Rewards/If this task fails) - each renders its own
  // `RewardViewToggle` in its header, but they all read/write this same
  // state so toggling from any one of them keeps the others in sync.
  const [rewardViewMode, setRewardViewMode] = useState<RewardViewMode>("cards");

  const task = taskId !== null ? tasksById.get(taskId) : undefined;
  const availability =
    task && progress && activeFaction !== undefined
      ? getQuestAvailability(tasks, progress, activeFaction).get(task.id)
      : undefined;
  const dependents = task ? getQuestDependents(task.id, tasks) : [];

  const sections: BentoSection[] = [];
  if (task) {
    sections.push({
      id: "prerequisites",
      title: "Prerequisites",
      weight: estimateSectionWeight(
        task.taskRequirements.length === 0
          ? ["No prerequisites."]
          : task.taskRequirements.map(
              (requirement) =>
                tasksById.get(requirement.taskId)?.name ?? `Unknown task (${requirement.taskId})`,
            ),
      ),
      content:
        task.taskRequirements.length === 0 ? (
          <p className="text-muted-foreground text-xs">No prerequisites.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {task.taskRequirements.map((requirement) => {
              const prereqTask = tasksById.get(requirement.taskId);
              const unmet = availability?.unmetPrereqTaskIds.includes(requirement.taskId) ?? false;
              return (
                <li key={requirement.taskId}>
                  {prereqTask ? (
                    <button
                      type="button"
                      className={`hover:underline ${unmet ? "text-status-red" : ""}`}
                      onClick={() => {
                        onSelectTask(requirement.taskId);
                      }}
                    >
                      {prereqTask.name}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">
                      Unknown task ({requirement.taskId})
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        ),
    });

    sections.push({
      id: "unlocks",
      title: "Unlocks",
      weight: estimateSectionWeight(
        dependents.length === 0
          ? ["Nothing unlocked."]
          : dependents.map((dependent) => dependent.name),
      ),
      content:
        dependents.length === 0 ? (
          <p className="text-muted-foreground text-xs">Nothing unlocked.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {dependents.map((dependent) => (
              <li key={dependent.id}>
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => {
                    onSelectTask(dependent.id);
                  }}
                >
                  {dependent.name}
                </button>
              </li>
            ))}
          </ul>
        ),
    });

    if (task.traderRequirements.length > 0) {
      sections.push({
        id: "trader-requirements",
        title: "Trader requirements",
        weight: estimateSectionWeight(task.traderRequirements.map(formatTraderRequirement)),
        content: (
          <ul className="flex flex-col gap-1">
            {task.traderRequirements.map((requirement, index) => {
              const unmet = availability?.unmetTraderRequirements.some(
                (entry) =>
                  entry.traderId === requirement.traderId &&
                  entry.requirementType === requirement.requirementType,
              );
              return (
                // A trader requirement has no stable id in this app's
                // normalized shape; index is fine since this list never
                // reorders within a render.
                <li key={index} className={unmet ? "text-status-red" : ""}>
                  {formatTraderRequirement(requirement)}
                </li>
              );
            })}
          </ul>
        ),
      });
    }

    if (task.itemRequirements.length > 0) {
      sections.push({
        id: "item-requirements",
        title: "Item requirements",
        weight: estimateSectionWeight(
          task.itemRequirements.map(
            (item) =>
              `${item.name} × ${String(item.count)}${item.foundInRaid ? " (found in raid)" : ""}`,
          ),
        ),
        content: (
          <ul className="flex flex-col gap-1.5">
            {task.itemRequirements.map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                {item.iconLink && (
                  // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon, not a local/optimizable asset.
                  <img src={item.iconLink} alt="" className="h-5 w-5 shrink-0 object-contain" />
                )}
                <span>
                  {item.name} × {item.count}
                  {item.foundInRaid && (
                    <span className="text-muted-foreground"> (found in raid)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ),
      });
    }

    if (task.objectives.length > 0) {
      const guideImages = QUEST_GUIDE_IMAGES[task.id];
      sections.push({
        id: "objectives",
        title: "Objectives",
        weight: estimateSectionWeight(
          task.objectives.map(
            (objective) => `${objective.description}${objective.optional ? " (optional)" : ""}`,
          ),
        ),
        content: (
          <>
            <ul className="marker:text-muted-foreground flex list-outside list-disc flex-col gap-1 pl-4">
              {task.objectives.map((objective) => (
                <li key={objective.id}>
                  {objective.description}
                  {objective.optional && <span className="text-muted-foreground"> (optional)</span>}
                </li>
              ))}
            </ul>
            {guideImages && <ObjectiveGuideImages images={guideImages} />}
          </>
        ),
      });
    }

    if (task.failConditions.length > 0) {
      sections.push({
        id: "fail-conditions",
        title: "Fail conditions",
        weight: estimateSectionWeight(
          task.failConditions.map(
            (condition) => `${condition.description}${condition.optional ? " (optional)" : ""}`,
          ),
        ),
        content: (
          <ul className="flex flex-col gap-1">
            {task.failConditions.map((condition) => (
              <li key={condition.id}>
                {condition.description}
                {condition.optional && <span className="text-muted-foreground"> (optional)</span>}
              </li>
            ))}
          </ul>
        ),
      });
    }

    const rewardHeaderAction = (
      <RewardViewToggle
        mode={rewardViewMode}
        onToggle={() => {
          setRewardViewMode((current) => (current === "cards" ? "list" : "cards"));
        }}
      />
    );

    if (task.startRewards && hasRewardContent(task.startRewards)) {
      sections.push({
        id: "starting-rewards",
        title: "Starting rewards",
        weight: estimateSectionWeight(
          formatRewardWeightLines(task.startRewards),
          TILE_PER_LINE_OVERHEAD,
        ),
        headerAction: rewardHeaderAction,
        content: <RewardDisplay rewards={task.startRewards} viewMode={rewardViewMode} />,
      });
    }

    sections.push({
      id: "rewards",
      title: "Rewards",
      weight:
        estimateSectionWeight([`${task.experience.toLocaleString()} XP`]) +
        (task.finishRewards
          ? estimateSectionWeight(
              formatRewardWeightLines(task.finishRewards),
              TILE_PER_LINE_OVERHEAD,
            )
          : 0),
      headerAction: rewardHeaderAction,
      content: (
        <>
          {/* Styled as its own small stat chip (icon badge + bold figure),
              matching the icon-tile visual language `RewardDisplay` uses
              below it, rather than a bare text line indistinguishable from
              any other paragraph in the dialog - XP is the one reward every
              task has, so it earns a bit more visual weight than the grid
              of optional item/standing/skill tiles underneath. */}
          <div className="mb-2 flex items-center gap-2">
            <span
              aria-hidden="true"
              className="bg-status-amber-soft text-status-amber flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            >
              <Zap className="h-4 w-4" />
            </span>
            <p className="text-lg font-bold">{task.experience.toLocaleString()} XP</p>
          </div>
          {task.finishRewards && (
            <RewardDisplay rewards={task.finishRewards} viewMode={rewardViewMode} />
          )}
        </>
      ),
    });

    if (task.failureOutcome && hasRewardContent(task.failureOutcome)) {
      sections.push({
        id: "failure-outcome",
        title: "If this task fails",
        weight: estimateSectionWeight(
          formatRewardWeightLines(task.failureOutcome),
          TILE_PER_LINE_OVERHEAD,
        ),
        headerAction: rewardHeaderAction,
        content: <RewardDisplay rewards={task.failureOutcome} viewMode={rewardViewMode} />,
      });
    }
  }
  const featuredIndex = selectFeaturedSectionIndex(sections.map((section) => section.weight));

  return (
    <Dialog open={taskId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {task?.taskImageLink ? (
          // `taskImageLink` is native 314×177 on tarkov.dev (confirmed via a
          // live fetch - no higher-res variant exists at any URL suffix),
          // well short of this dialog's ~600px content width - stretching it
          // full-bleed at the previous h-40/h-48 height made the upscaling
          // blur the dominant visual. Kept full-bleed anyway (matching the
          // homepage `PhotoFeatureCard` treatment this mirrors, right down to
          // the bottom `from-card` scrim standing in for its `from-card
          // via-card/90` gradient) rather than shrinking it to a small
          // native-res thumbnail, since a standalone tiny banner would break
          // that shared visual language - shrunk the height instead so less
          // of the soft image is on screen, and let the title/badge scrim
          // cover the blurriest lower portion instead of floating below it.
          <div className="relative -mx-6 -mt-6 mb-4 h-32 overflow-hidden rounded-t-lg sm:h-40">
            {/* eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon, not a local/optimizable asset. */}
            <img
              src={task.taskImageLink}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/50 to-transparent"
            />
            <div
              aria-hidden="true"
              className="from-card via-card/85 pointer-events-none absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t to-transparent"
            />
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 px-6 pb-4 sm:pb-5">
              <DialogTitle className="text-xl [text-shadow:0_1px_4px_rgba(0,0,0,0.55)] sm:text-2xl">
                {task.name}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-1.5">
                <TaskBadges task={task} availability={availability} overlaid />
              </div>
            </div>
          </div>
        ) : (
          <DialogHeader>
            <DialogTitle>{task?.name ?? "Quest"}</DialogTitle>
            {task && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <TaskBadges task={task} availability={availability} overlaid={false} />
              </div>
            )}
          </DialogHeader>
        )}

        {!task ? (
          <p className="text-muted-foreground mt-4 text-sm">Quest not found.</p>
        ) : (
          <div className="mt-4 flex flex-col gap-5 text-sm">
            {task.wikiLink && (
              <a
                href={task.wikiLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-status-blue hover:underline"
              >
                Wiki guide
              </a>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              {sections.map((section, index) => (
                <Card
                  key={section.id}
                  className={index === featuredIndex ? "sm:col-span-2" : undefined}
                >
                  <CardHeader className="flex-row items-center justify-between gap-1 p-4 pb-1.5">
                    <CardTitle className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                      {section.title}
                    </CardTitle>
                    {section.headerAction}
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-sm">{section.content}</CardContent>
                </Card>
              ))}
            </div>

            {availability?.status === "inprog" && !task.restartable && (
              <p className="text-muted-foreground text-xs">
                This task cannot be retried after failing.
              </p>
            )}

            <div className="flex flex-wrap gap-2 border-t pt-4">
              {availability?.status === "notstarted" && (
                <Button
                  type="button"
                  disabled={!availability.isAvailable}
                  onClick={() => {
                    startTask(task.id);
                  }}
                >
                  Start
                </Button>
              )}
              {availability?.status === "inprog" && (
                <>
                  <Button
                    type="button"
                    onClick={() => {
                      doneTask(task.id);
                    }}
                  >
                    Complete
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      failTask(task.id);
                    }}
                  >
                    Fail
                  </Button>
                </>
              )}
              {(availability?.status === "done" || availability?.status === "failed") && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    undoTask(task.id);
                  }}
                >
                  Undo
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  togglePinnedTask(task.id);
                }}
              >
                {pinnedTaskIds.includes(task.id) ? "Unpin" : "Pin"}
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Close
                </Button>
              </DialogClose>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
