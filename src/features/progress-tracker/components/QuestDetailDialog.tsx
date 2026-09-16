"use client";

import {
  AlertTriangle,
  BookOpen,
  ExternalLink,
  Gift,
  Images,
  LayoutGrid,
  List,
  Lock,
  MapPin,
  Package,
  ShieldAlert,
  Target,
  TrendingUp,
  Unlock,
  Users,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

import { isMoneyItem } from "@/shared/lib/flea-market/item-predicates";
import { wikiSlugFromLink } from "@/shared/lib/wiki/fetch-wiki";
import { useWikiGuideData } from "@/shared/lib/wiki/use-wiki";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";
import { Lightbox } from "@/shared/ui/lightbox/Lightbox";

import { useActiveFaction } from "../hooks/use-active-faction";
import { useActiveModeTasks } from "../hooks/use-active-mode-tasks";
import { useActiveProgress } from "../hooks/use-active-progress";
import { useTaskActions } from "../hooks/use-task-actions";
import {
  estimateSectionWeight,
  selectFeaturedSectionIndex,
  TILE_PER_LINE_OVERHEAD,
} from "../lib/quest-detail-bento";
import {
  formatTraderRequirement,
  getQuestDependents,
  getTaskAvailability,
} from "../selectors/quest-availability";
import { useProgressTrackerStore } from "../store";

import { statusBadge } from "./QuestCard";

import type { QuestAvailability } from "../selectors/quest-availability";
import type { NormalizedTask, RawFinishRewards } from "@/shared/lib/tarkov-api/types";
import type { WikiImage } from "@/shared/lib/wiki/fetch-wiki";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface QuestDetailDialogProps {
  /** `null` closes the dialog. */
  taskId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Lets the caller re-target the dialog at a prerequisite/dependent quest without closing it. */
  onSelectTask: (taskId: string) => void;
  /**
   * Optional caller-supplied controls, rendered at the top of the body. A
   * slot rather than a prop per control, so a surface can attach an action
   * that only makes sense there (the map screen's "show only this task on
   * map") without this shared dialog having to know anything about it.
   */
  actions?: ReactNode;
}

/**
 * Groups a `BentoSection` for icon-chip coloring, so a section's *kind* is
 * legible at a glance instead of every tile using the same neutral chip:
 * "reward" (amber, a payoff) and "warning" (red, a fail state) stand out
 * from the plain informational default before a word is even read.
 */
type BentoAccent = "info" | "reward" | "warning";

interface BentoSection {
  id: string;
  title: string;
  weight: number;
  content: ReactNode;
  /** Small icon rendered in the section's own tinted chip, next to its title. */
  icon: LucideIcon;
  /** Defaults to "info" (neutral) when omitted. */
  accent?: BentoAccent;
  /** Extra control rendered next to the title itself (e.g. `RewardViewToggle`); absent for every section that doesn't need one. */
  headerAction?: ReactNode;
}

/** `BentoAccent` -> the icon chip's own background/foreground classes. */
const ACCENT_CHIP_CLASSES: Record<BentoAccent, string> = {
  info: "bg-muted text-muted-foreground",
  reward: "bg-status-amber-soft text-status-amber",
  warning: "bg-status-red-soft text-status-red",
};

/**
 * `true` when a `RawFinishRewards` object actually has anything to show.
 * A task's `startRewards`/`failureOutcome` can be a non-null object with
 * every field an empty array (i.e. "no starting reward," not `null`), so
 * gating a whole section (including its heading) on mere object presence
 * rendered an empty "Starting rewards" heading with nothing under it for
 * e.g. the real "Debut" task. Callers must gate on this, not on
 * `rewards !== null` alone.
 */
export function hasRewardContent(rewards: RawFinishRewards): boolean {
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
  /** `true` for the two trader-logo buckets (`traderStanding`/`traderUnlock`): rendered as a circular portrait (`rounded-full object-cover`), matching `QuestTreeView.tsx`'s trader-lane-header convention, instead of the item buckets' plain square `object-contain`. */
  traderPortrait: boolean;
  /** Full-precision text, always what list mode and the weight estimate use. */
  label: string;
  /** Card/tile-mode-only override of `label` (`null` when the full label is fine at tile width). Currently only set for money, whose full comma-grouped amount ("13,000₽") overflow-clips inside a narrow tile column by a couple px. List mode intentionally never reads this since it has room for the real, precise figure. */
  cardLabel: string | null;
  caption: string | null;
  /** Corner-badge quantity text (e.g. `"×2"`), set only when count > 1; a bare "×1" is noise. Always `null` for money (see `formatMoneyAmount`): the formatted amount already carries the count, and a 5-6 digit rouble amount doesn't fit a small corner badge anyway. */
  badge: string | null;
}

/** Tarkov.dev `shortName` -> currency symbol, for `formatMoneyAmount`/`abbreviateMoneyAmount`. */
const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = { rub: "₽", usd: "$", eur: "€" };

/**
 * A quest's money reward is always some non-trivial multiple (Roubles
 * counts routinely run 5-6 digits), unlike a stackable item reward where
 * "×2" vs "×1" is the interesting distinction, so money gets its own
 * formatted amount as the entry's primary label (e.g. "15,000₽") instead
 * of the generic item-shortName-plus-corner-badge treatment every other
 * item reward uses. Full precision: this is `RewardEntry.label`, not
 * `.cardLabel`; see `abbreviateMoneyAmount` for the space-constrained
 * tile-only form.
 */
function formatMoneyAmount(shortName: string, count: number): string {
  const symbol = CURRENCY_SYMBOLS[shortName.toLowerCase()] ?? "";
  return `${count.toLocaleString()}${symbol}`;
}

/**
 * Compact "15K₽"/"1.2M₽" form for a money reward. Even a plain 5-digit
 * amount like "13,000₽" overflow-clips inside a 4-column tile grid's
 * narrow columns by a couple px, so the full comma-grouped form from
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
 * grid/list) and `formatRewardWeightLines` (the bento-grid weight estimate)
 * build from. Both always agree on exactly which entries a reward section
 * "contains," even though each formats that shared data differently for
 * its own purpose (short tile label vs. a flatter weight-estimate string).
 */
function buildRewardEntries(rewards: RawFinishRewards): RewardEntry[] {
  const entries: RewardEntry[] = [];
  rewards.items.forEach((entry, index) => {
    // `RawFinishRewardItem.item` has no `types` field (unlike the catalog
    // item shape `isMoneyItem` was written against). Passing `types: []`
    // is safe since it just falls through to `isMoneyItem`'s own
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

/** One entry's plain-text form (`"label caption badge"`, skipping empty parts), shared by the weight estimate and the bullet-list view mode so all three (grid, list, weight) always agree on what an entry "says." */
function formatRewardEntryLine(entry: RewardEntry): string {
  return `${entry.label}${entry.caption ? ` ${entry.caption}` : ""}${entry.badge ? ` ${entry.badge}` : ""}`;
}

/** Weight-estimate-only text form, derived from the same entries `RewardDisplay` renders, so the estimate can't silently disagree with what actually exists in a section. */
function formatRewardWeightLines(rewards: RawFinishRewards): string[] {
  return buildRewardEntries(rewards).map(formatRewardEntryLine);
}

export type RewardViewMode = "cards" | "list";

/**
 * Renders a reward section's entries either as a grid of icon tiles (large
 * icon, short label, optional caption/corner-quantity-badge: large icons
 * and shortened labels, `.shortName` not the full item name, read more like
 * Tarkov's own inventory UI and stay scannable even when a section has 6-8
 * rewards) or as a plain bullet list (`RewardViewToggle` in each reward
 * section's own header switches between the two, one shared mode across
 * every reward section in the dialog). Tile mode is deliberately not
 * interactive (no `<button>`/hover state); unlike `KappaItemCard.tsx`'s
 * similar icon-tile convention, nothing here is clickable.
 */
export function RewardDisplay({
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
    // `flex flex-wrap` with each tile a fixed `w-20`, not a `grid-cols-*`
    // track layout: a grid reserves a full row's worth of equal-width
    // columns regardless of how many entries actually exist, so a
    // 2-entry reward (common - money plus one trader-standing bump) left
    // 1-2 phantom empty columns of dead space to the right of the row,
    // most visible in `CommandDeckBoard`'s much wider detail pane. Fixed-
    // width flex tiles just hug the left and wrap onto a new line once
    // they run out of room, so a short reward list reads as "a short row,"
    // not "a wide row with holes in it."
    <ul className="mt-1 flex flex-wrap gap-2">
      {entries.map((entry) => (
        <li
          key={entry.key}
          // `justify-center` (not the flex default `justify-start`) matters
          // here specifically because the row stretches every tile in it
          // to the tallest sibling's height in that line (flexbox's own
          // default `align-items: stretch`): a two-line entry (icon + label
          // + caption, e.g. a trader-standing reward) and a one-line entry
          // (icon + label only, e.g. a money reward with no caption) then
          // occupy the same tile height. Top-aligned content left the
          // shorter entry's extra space stranded below it as a lopsided gap;
          // centering distributes it evenly above/below instead, so a
          // one-line tile doesn't read as visually broken next to its
          // two-line neighbors.
          className="bg-background relative flex w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-md p-2 text-center"
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
          {/* `w-full` is load-bearing here, not decorative. The parent
              `<li>` is a `flex flex-col items-center` column, so without an
              explicit width these spans size to their own text content
              (`items-center`'s cross-axis default) and `truncate`'s
              `overflow-hidden` never has anything to actually clip: a long
              reward name like "Mosin Infantry Default" rendered at full
              width and visually bled into the next grid tile instead of
              ellipsizing. */}
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
 * bento section (Starting rewards/Rewards/If this task fails). All three
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

/** One thumbnail in the Guide section's screenshot grid. Factored out so both the flat-grid and grouped-by-section layouts render the exact same button. */
function WikiScreenshotThumbnail({ image, onSelect }: { image: WikiImage; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="border-border overflow-hidden rounded-md border text-left"
      title={image.caption || "Open full size"}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- external wiki-hosted screenshot, not a local/optimizable asset. */}
      <img
        src={image.src}
        alt={image.caption}
        // No `loading="lazy"`: inside the dialog's scroll area lazy images
        // below the fold never entered the viewport, so they stayed blank
        // white boxes.
        //
        // Fandom's image CDN 404s any request that carries a `Referer`
        // header from a non-Fandom origin (real anti-hotlink protection,
        // not a Cloudflare/bot-detection issue like the wiki page itself).
        // This was the root cause of every screenshot 404ing in this grid.
        referrerPolicy="no-referrer"
        className="aspect-video w-full object-cover"
        // Collapse a screenshot that genuinely fails, rather than leaving
        // an empty box.
        onError={(event) => {
          const button = event.currentTarget.closest("button");
          if (button) button.style.display = "none";
        }}
      />
    </button>
  );
}

/**
 * Groups `images` into consecutive runs sharing the same `section` (the
 * wiki's own `<h3>`/`<h4>` subsection, e.g. Shooting Cans' "Utyos"/"AGS")
 * for the Guide section's grouped screenshot layout. A run rather than a
 * full group-by-key so a lone overview image with no `section` (e.g. a
 * shared map screenshot that appears before any subsection) gets its own
 * leading, unlabeled row instead of being merged with anything. Preserves
 * each image's original flat index (unchanged from `images`) since that's
 * what `Lightbox`'s `index` prop addresses.
 */
function groupImagesBySection(
  images: readonly WikiImage[],
): { section: string | undefined; items: { image: WikiImage; index: number }[] }[] {
  const groups: { section: string | undefined; items: { image: WikiImage; index: number }[] }[] =
    [];
  for (const [index, image] of images.entries()) {
    const last = groups[groups.length - 1];
    if (last && last.section === image.section) {
      last.items.push({ image, index });
    } else {
      groups.push({ section: image.section, items: [{ image, index }] });
    }
  }
  return groups;
}

/**
 * The trader/level/Kappa/Lightkeeper/status badge row, shared by both places
 * `QuestDetailDialog`'s heading can render: `overlaid` (the badges sit on top
 * of the hero photo, `PhotoFeatureCard`-style) swaps every badge's own subtle
 * tinted background (only legible against the page's own flat surface, not
 * a busy photo underneath) for the same `bg-background/70 backdrop-blur-sm`
 * chip treatment the homepage's own photo-card tags use, while leaving each
 * variant's text color (the part that actually carries meaning: amber for
 * "Available," the Kappa gold, etc.) untouched. Exported alongside
 * `RewardDisplay`/`hasRewardContent` so `CommandDeckBoard`'s inline detail
 * panel renders the exact same badges/rewards as this dialog rather than a
 * second, driftable copy.
 */
export function TaskBadges({
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
 * Turns a `normalizedName` map key (e.g. `"the-lab"`) into a display label
 * (`"The Lab"`). No existing map-name lookup convention exists elsewhere in
 * progress-tracker (every other view shows trader/loyalty context, never a
 * map name), so a title-cased version of the normalized name is used
 * directly rather than pulling in a whole `useTarkovGameData().maps` fetch
 * for one label.
 */
function formatMapName(normalizedName: string): string {
  return normalizedName
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export interface QuestDetailSectionsProps {
  task: NormalizedTask;
  tasksById: ReadonlyMap<string, NormalizedTask>;
  /** Full task list (not just currently-visible/filtered ones), for `getQuestDependents`. */
  tasksData: readonly NormalizedTask[];
  availability: QuestAvailability | undefined;
  /** Re-targets whatever's rendering these sections at a prerequisite/dependent quest (e.g. re-pointing `QuestDetailDialog` at it, or `CommandDeckBoard` selecting its trader+task) without navigating away from this view. */
  onSelectTask: (taskId: string) => void;
}

/**
 * The informational guts of a task's full detail view: map(s), a wiki link,
 * then prerequisites/unlocks/trader-loyalty-gates/item-requirements/
 * objectives/rewards/fail-conditions as a 2-column bento grid
 * (`BentoSection`, weighted by `estimateSectionWeight` so the single
 * largest section spans both columns when the count is odd), plus the
 * wiki-sourced Guide prose and screenshot gallery (`useWikiGuideData`) and
 * its `Lightbox`.
 *
 * Shared by `QuestDetailDialog` (which wraps this in a `Dialog` with its own
 * hero image and Start/Complete/Fail/Undo/Pin/Close action row) and
 * `CommandDeckBoard`'s inline per-trader detail pane (no dialog at all -
 * this render IS the detail view there, replacing what used to be a
 * "Full details" button opening this same content in a separate dialog), so
 * the two can never drift into disagreeing about what a task's full details
 * actually contain. Deliberately renders no task-status action buttons
 * itself: each caller's own button set differs (the dialog adds a Close
 * button Command Deck has no use for), so that stays each caller's concern.
 *
 * `Lightbox` renders its own `Dialog` regardless of where in the tree it's
 * placed (Radix portals it to `document.body`), so nesting it here instead
 * of as a sibling of `QuestDetailDialog`'s own `Dialog` changes nothing
 * about how/where it actually paints.
 */
export function QuestDetailSections({
  task,
  tasksById,
  tasksData,
  availability,
  onSelectTask,
}: QuestDetailSectionsProps) {
  // One shared mode across every reward-bearing section (Starting rewards/
  // Rewards/If this task fails): toggling from any one keeps the others in
  // sync rather than drifting into a mismatched mix of list/card sections.
  const [rewardViewMode, setRewardViewMode] = useState<RewardViewMode>("cards");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Previously unmemoized in `QuestDetailDialog`: an O(n) scan over ~510
  // tasks on every render (the reward-view toggle, the lightbox index, wiki
  // data arriving all re-render this without changing which task is open).
  const dependents = useMemo(() => getQuestDependents(task.id, tasksData), [task.id, tasksData]);

  // EFT fandom wiki: the task's Guide section text + a screenshot gallery,
  // fetched (and cached) only while this task is the one being shown.
  // Degrades to empty text and an empty image list on any failure.
  const wikiSlug = wikiSlugFromLink(task.wikiLink, task.name);
  const { data: wikiGuideData } = useWikiGuideData(wikiSlug);
  const wikiGuide = wikiGuideData?.text;
  const wikiImages = wikiGuideData?.images;

  const sections: BentoSection[] = [];
  sections.push({
    id: "prerequisites",
    title: "Prerequisites",
    icon: Lock,
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
                  <span className="text-muted-foreground">Unknown task ({requirement.taskId})</span>
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
    icon: Unlock,
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
      icon: Users,
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
      icon: Package,
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
    sections.push({
      id: "objectives",
      title: "Objectives",
      icon: Target,
      weight: estimateSectionWeight(
        task.objectives.map(
          (objective) => `${objective.description}${objective.optional ? " (optional)" : ""}`,
        ),
      ),
      content: (
        <ul className="marker:text-muted-foreground flex list-outside list-disc flex-col gap-1 pl-4">
          {task.objectives.map((objective) => (
            <li key={objective.id}>
              {objective.description}
              {objective.optional && <span className="text-muted-foreground"> (optional)</span>}
            </li>
          ))}
        </ul>
      ),
    });
  }

  if (task.failConditions.length > 0) {
    sections.push({
      id: "fail-conditions",
      title: "Fail conditions",
      icon: ShieldAlert,
      accent: "warning",
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
      icon: Gift,
      accent: "reward",
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
    icon: Gift,
    accent: "reward",
    weight:
      estimateSectionWeight([`${task.experience.toLocaleString()} XP`]) +
      (task.finishRewards
        ? estimateSectionWeight(formatRewardWeightLines(task.finishRewards), TILE_PER_LINE_OVERHEAD)
        : 0),
    headerAction: rewardHeaderAction,
    content: (
      <>
        {/* Styled as its own small stat chip (icon badge + bold figure),
            matching the icon-tile visual language `RewardDisplay` uses
            below it, rather than a bare text line indistinguishable from
            any other paragraph. XP is the one reward every task has, so it
            earns a bit more visual weight than the grid of optional item/
            standing/skill tiles underneath. */}
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
      icon: AlertTriangle,
      accent: "warning",
      weight: estimateSectionWeight(
        formatRewardWeightLines(task.failureOutcome),
        TILE_PER_LINE_OVERHEAD,
      ),
      headerAction: rewardHeaderAction,
      content: <RewardDisplay rewards={task.failureOutcome} viewMode={rewardViewMode} />,
    });
  }

  const featuredIndex = selectFeaturedSectionIndex(sections.map((section) => section.weight));
  const hasMeta = task.maps.length > 0 || Boolean(task.wikiLink);

  return (
    <>
      {hasMeta && (
        <div className="border-border/60 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b pb-4 text-xs">
          {task.maps.length > 0 && (
            <span className="text-muted-foreground flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {task.maps.map(formatMapName).join(", ")}
            </span>
          )}
          {task.wikiLink && (
            <a
              href={task.wikiLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-status-blue flex items-center gap-1.5 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Wiki guide
            </a>
          )}
        </div>
      )}

      {/* `items-start` (not the grid default `stretch`): a row pairs a short
          tile (e.g. a 1-line "No prerequisites.") with a tall one (e.g. a
          6-entry reward grid), and `stretch` grew the short tile's box to
          match the tall one's row height, leaving a slab of dead space below
          its own content. Each tile now sizes to its own content only. */}
      <div className="grid items-start gap-3 sm:grid-cols-2">
        {sections.map((section, index) => {
          const Icon = section.icon;
          return (
            <div
              key={section.id}
              className={`bg-muted/40 rounded-md p-4 ${index === featuredIndex ? "sm:col-span-2" : ""}`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${ACCENT_CHIP_CLASSES[section.accent ?? "info"]}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <h3 className="text-xs font-semibold tracking-wide uppercase">{section.title}</h3>
                </div>
                {section.headerAction}
              </div>
              <div className="text-sm">{section.content}</div>
            </div>
          );
        })}
      </div>

      {(Boolean(wikiGuide) || (wikiImages && wikiImages.length > 0)) && (
        <div className="bg-muted/40 flex flex-col gap-4 rounded-md p-4">
          {wikiGuide && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="bg-muted text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                >
                  <BookOpen className="h-3.5 w-3.5" />
                </span>
                <h3 className="text-xs font-semibold tracking-wide uppercase">Guide</h3>
              </div>
              <div className="flex flex-col gap-2">
                {wikiGuide.split("\n\n").map((paragraph, index) => (
                  <p key={index} className="text-muted-foreground text-sm leading-relaxed">
                    {paragraph}
                  </p>
                ))}
              </div>
            </div>
          )}

          {wikiImages && wikiImages.length > 0 && (
            <div
              className={`flex flex-col gap-3 ${wikiGuide ? "border-border/60 border-t pt-4" : ""}`}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="bg-muted text-muted-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                >
                  <Images className="h-3.5 w-3.5" />
                </span>
                <h3 className="text-xs font-semibold tracking-wide uppercase">Screenshots</h3>
              </div>
              {groupImagesBySection(wikiImages).map((group) => (
                <div key={group.items[0]?.index}>
                  {group.section && (
                    <h4 className="text-muted-foreground bg-background mb-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase">
                      {group.section}
                    </h4>
                  )}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {group.items.map(({ image, index }) => (
                      <WikiScreenshotThumbnail
                        key={image.src}
                        image={image}
                        onSelect={() => {
                          setLightboxIndex(index);
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Lightbox images={wikiImages ?? []} index={lightboxIndex} onIndexChange={setLightboxIndex} />
    </>
  );
}

/**
 * Full detail view for one task: `QuestDetailSections`'s bento grid/guide/
 * screenshots, plus the same status actions `QuestCard` exposes. Reads its
 * own data (live game data + active profile) the same way
 * `CharacterStatsDialog` does, so callers only need to pass a `taskId`.
 *
 * A full-width hero image (`task.taskImageLink`) leads the dialog when one
 * exists, breaking out of `DialogContent`'s own padding via a negative
 * margin rather than touching the shared `Dialog.tsx` (used by 8 other
 * dialogs). The title and trader/level/Kappa/status badges (`TaskBadges`)
 * sit overlaid on it via a bottom gradient scrim, `PhotoFeatureCard`-style
 * (the homepage's own photo cards), rather than floating in plain text below
 * it. A task with no hero image falls back to a plain `DialogHeader` with
 * the same badge row underneath instead.
 */
export function QuestDetailDialog({
  taskId,
  onOpenChange,
  onSelectTask,
  actions,
}: QuestDetailDialogProps) {
  // `tasksById` is mode-resolved too (not `useTarkovIndexes()`'s, which is
  // always the regular/PvP list) so a task detail opened while PvE is
  // active resolves against the right list.
  const { tasks: tasksData, tasksById } = useActiveModeTasks();

  const progress = useActiveProgress();
  const activeFaction = useActiveFaction();
  const pinnedTaskIds = progress?.pinnedTaskIds ?? [];
  const togglePinnedTask = useProgressTrackerStore((state) => state.togglePinnedTask);
  const { startTask, doneTask, failTask, undoTask } = useTaskActions();

  const task = taskId !== null ? tasksById.get(taskId) : undefined;
  // `getTaskAvailability` (not `getQuestAvailability`): this dialog only
  // ever needs one task's result, so gating the other ~509 just to throw
  // them away was real, previously-unmemoized wasted work on every render
  // while this dialog is open.
  const availability = useMemo(
    () =>
      task && progress && activeFaction !== undefined
        ? getTaskAvailability(task, tasksById, progress, activeFaction)
        : undefined,
    [task, tasksById, progress, activeFaction],
  );

  return (
    <Dialog open={taskId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {task?.taskImageLink ? (
          // `taskImageLink` is native 314×177 on tarkov.dev (no
          // higher-res variant exists at any URL suffix), well short of
          // this dialog's ~600px content width, so stretching it
          // full-bleed at the previous h-40/h-48 height made the
          // upscaling blur the dominant visual. Kept full-bleed anyway
          // (matching the homepage `PhotoFeatureCard` treatment this
          // mirrors, right down to the bottom `from-card` scrim standing
          // in for its `from-card via-card/90` gradient) rather than
          // shrinking it to a small native-res thumbnail, since a
          // standalone tiny banner would break that shared visual
          // language. Shrunk the height instead so less of the soft
          // image is on screen, and let the title/badge scrim cover the
          // blurriest lower portion instead of floating below it.
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
            {actions}
            <QuestDetailSections
              task={task}
              tasksById={tasksById}
              tasksData={tasksData ?? []}
              availability={availability}
              onSelectTask={onSelectTask}
            />

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
