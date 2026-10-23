"use client";

import { useId, useState } from "react";

import { useTarkovIndexes } from "@/shared/lib/tarkov-api/use-tarkov-indexes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";
import { openItemDetail } from "@/shared/ui/item-detail/item-detail-store";
import { cn } from "@/shared/ui/lib/cn";
import { SegmentedControl } from "@/shared/ui/segmented-control/SegmentedControl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs/Tabs";

import {
  LOOT_CATEGORIES,
  LOOT_TIERS,
  PMC_TOTAL_HP,
  filterLoot,
  formatChance,
  getBossLoadout,
  lootTier,
} from "../lib/boss-loadout";

import { BossPortrait, TONE_TEXT, spawnChanceText } from "./BossStrip";

import type { BossPill } from "../lib/boss-groups";
import type {
  BossGearSlot,
  BossHealthPart,
  BossLoadout,
  BossLootEntry,
  LootCategory,
} from "../lib/boss-loadout";
import type { NormalizedItem, RawMob } from "@/shared/lib/tarkov-api/types";
import type { RefObject } from "react";

type ItemsById = Readonly<Record<string, NormalizedItem>>;

/** "1 item" / "3 items", with an optional word before the noun ("1 rare item"). */
function countLabel(count: number, adjective = ""): string {
  const noun = count === 1 ? "item" : "items";
  return `${String(count)} ${adjective ? `${adjective} ` : ""}${noun}`;
}

const SECTION_HEADING = "font-display text-sm font-semibold tracking-wide uppercase";
const SUBHEADING = "text-muted-foreground text-[10px] font-semibold tracking-wide uppercase";

interface ItemRowProps {
  itemId: string;
  chance: number;
  itemsById: ItemsById;
  /** Spoken after the chance, e.g. "of sample loadouts". */
  chanceContext: string;
  /** Marks the chance as a rough estimate: shown as "~73%", spoken as "about 73%". */
  approximate?: boolean;
  /** Optional second line (a weapon's loaded rounds). */
  detail?: string | undefined;
}

/** One item with its chance; clicking opens the app-wide item detail dialog (flea price, quest and hideout use). */
function ItemRow({
  itemId,
  chance,
  itemsById,
  chanceContext,
  approximate = false,
  detail,
}: ItemRowProps) {
  const item = itemsById[itemId];
  const name = item?.name ?? itemId;
  const chanceLabel = `${approximate ? "~" : ""}${formatChance(chance)}`;
  const spokenChance = `${approximate ? "about " : ""}${formatChance(chance)}`;
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          openItemDetail(itemId);
        }}
        aria-label={`${name}, ${spokenChance} ${chanceContext}${detail ? `. ${detail}` : ""}`}
        // Full name on hover, since long weapon names truncate.
        title={`${name} · click for item details`}
        className="hover:bg-muted focus-visible:ring-ring flex w-full cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none focus-visible:ring-2"
      >
        {item?.iconLink ? (
          // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon, not a local/optimizable asset.
          <img src={item.iconLink} alt="" className="h-8 w-8 shrink-0 object-contain" />
        ) : (
          <span aria-hidden="true" className="bg-muted h-8 w-8 shrink-0 rounded" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm">{name}</span>
          {detail && <span className="text-muted-foreground block truncate text-xs">{detail}</span>}
        </span>
        <span className="shrink-0 text-xs font-semibold tabular-nums">{chanceLabel}</span>
      </button>
    </li>
  );
}

/** "Loaded: 7.62x54mm R LPS gzh, BT gzh" from a weapon's ammo ids, or undefined when none were seen. */
function ammoDetail(ammoItemIds: readonly string[], itemsById: ItemsById): string | undefined {
  if (ammoItemIds.length === 0) return undefined;
  const names = ammoItemIds.map((id) => itemsById[id]?.shortName ?? id);
  return `Loaded: ${names.join(", ")}`;
}

interface GearPanelProps {
  gear: readonly BossGearSlot[];
  samples: number;
  itemsById: ItemsById;
}

function GearPanel({ gear, samples, itemsById }: GearPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* The tab already names this panel visually; the hidden heading
          keeps it reachable by heading navigation, like "Loot" next to it. */}
      <h3 className="sr-only">Gear</h3>
      <p className="text-muted-foreground text-xs">
        {samples > 0
          ? `Rough estimate from ${String(samples)} sample loadouts in tarkov.dev's data, not the game's real odds.`
          : "No gear data for this enemy yet."}
      </p>
      {gear.map((slot) => (
        <div key={slot.slot}>
          <h4 className={SUBHEADING}>{slot.label}</h4>
          <ul>
            {slot.options.map((option) => (
              <ItemRow
                key={option.itemId}
                itemId={option.itemId}
                chance={option.chance}
                itemsById={itemsById}
                chanceContext="of sample loadouts"
                approximate
                detail={ammoDetail(option.ammoItemIds, itemsById)}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

interface HealthPanelProps {
  parts: readonly BossHealthPart[];
  total: number | null;
}

/**
 * Max HP per body part as a small table with a bar per row. One series of
 * magnitudes, so one hue and no legend: every value is written as text in
 * its own cell (the bars are decorative, hidden from screen readers), and
 * bars share a zero baseline scaled to this boss's largest part. A PMC's HP
 * for the same part sits alongside as a familiar yardstick.
 */
function HealthPanel({ parts, total }: HealthPanelProps) {
  const largest = Math.max(1, ...parts.map((part) => part.max));
  return (
    <div className="flex flex-col gap-3">
      <h3 className="sr-only">Health</h3>
      <p className="text-muted-foreground text-xs">
        {parts.length > 0
          ? `Max HP per body part${total ? `, ${total.toLocaleString("en-US")} in total` : ""}. A PMC has ${String(PMC_TOTAL_HP)}.`
          : "No health data for this enemy yet."}
      </p>
      {parts.length > 0 && (
        <table className="w-full text-sm">
          <caption className="sr-only">
            Max HP per body part, with a PMC&apos;s for comparison
          </caption>
          <thead>
            <tr className={SUBHEADING}>
              <th scope="col" className="pb-1 text-left font-semibold">
                Body part
              </th>
              <th scope="col" className="pb-1">
                <span className="sr-only">Bar</span>
              </th>
              <th scope="col" className="pb-1 text-right font-semibold">
                Max HP
              </th>
              <th scope="col" className="pb-1 pl-3 text-right font-semibold">
                PMC
              </th>
            </tr>
          </thead>
          <tbody>
            {parts.map((part) => (
              <tr
                key={part.part}
                title={`${part.label}: ${String(part.max)} HP${part.pmcMax ? ` (a PMC has ${String(part.pmcMax)})` : ""}`}
              >
                <th scope="row" className="py-1 pr-3 text-left font-normal whitespace-nowrap">
                  {part.label}
                </th>
                <td aria-hidden="true" className="w-full py-1">
                  <div
                    className="bg-primary h-2 rounded-r-[4px]"
                    style={{ width: `${String((part.max / largest) * 100)}%` }}
                  />
                </td>
                <td className="py-1 pl-3 text-right font-semibold tabular-nums">{part.max}</td>
                <td className="text-muted-foreground py-1 pl-3 text-right tabular-nums">
                  {part.pmcMax ?? "-"}
                </td>
              </tr>
            ))}
          </tbody>
          {total !== null && (
            <tfoot>
              <tr className="border-border border-t">
                <th scope="row" className="pt-1.5 pr-3 text-left font-semibold">
                  Total
                </th>
                <td aria-hidden="true" />
                <td className="pt-1.5 pl-3 text-right font-semibold tabular-nums">
                  {total.toLocaleString("en-US")}
                </td>
                <td className="text-muted-foreground pt-1.5 pl-3 text-right tabular-nums">
                  {PMC_TOTAL_HP}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </div>
  );
}

type DetailsView = "gear" | "health";

interface DetailsColumnProps {
  loadout: BossLoadout;
  itemsById: ItemsById;
}

/**
 * The card's left column: Gear or Health, switched by a full-width tab bar
 * styled like the loot filter beside it. Real tabs rather than
 * `SegmentedControl`, since this swaps a whole panel rather than filtering
 * one (`SegmentedControl`'s own doc draws that same line).
 */
function DetailsColumn({ loadout, itemsById }: DetailsColumnProps) {
  const [view, setView] = useState<DetailsView>("gear");
  return (
    <Tabs
      value={view}
      onValueChange={(next) => {
        if (next === "gear" || next === "health") setView(next);
      }}
      className="flex flex-col gap-3 p-4 md:min-h-0 md:overflow-y-auto"
    >
      <TabsList aria-label="Boss details" className="w-full">
        <TabsTrigger value="gear" className="flex-1">
          Gear
        </TabsTrigger>
        <TabsTrigger value="health" className="flex-1">
          Health
        </TabsTrigger>
      </TabsList>
      <TabsContent value="gear" className="mt-0 outline-none">
        <GearPanel gear={loadout.gear} samples={loadout.gearSamples} itemsById={itemsById} />
      </TabsContent>
      <TabsContent value="health" className="mt-0 outline-none">
        <HealthPanel parts={loadout.healthParts} total={loadout.health} />
      </TabsContent>
    </Tabs>
  );
}

interface LootSectionProps {
  loot: readonly BossLootEntry[];
  itemsById: ItemsById;
}

function LootSection({ loot, itemsById }: LootSectionProps) {
  const headingId = useId();
  const searchId = useId();
  const rareListId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<LootCategory>("all");
  const [showRare, setShowRare] = useState(false);

  const visible = filterLoot(loot, itemsById, query, category);
  const searching = query.trim().length > 0;
  const tiers = LOOT_TIERS.map((tier) => ({
    ...tier,
    entries: visible.filter((entry) => lootTier(entry.chance) === tier.tier),
  })).filter((tier) => tier.entries.length > 0);

  return (
    <section
      aria-labelledby={headingId}
      className="border-border flex flex-col gap-3 border-t p-4 md:min-h-0 md:overflow-y-auto md:border-t-0 md:border-l"
    >
      <div>
        <h3 id={headingId} className={SECTION_HEADING}>
          Loot
        </h3>
        <p className="text-muted-foreground text-xs">
          {loot.length > 0
            ? "How often tarkov.dev's data shows this boss carrying each item. A rough guide, not official drop rates."
            : "No loot data for this enemy yet."}
        </p>
      </div>
      {loot.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <label htmlFor={searchId} className="sr-only">
              Search loot
            </label>
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search loot (e.g. key)"
              className="border-input bg-background focus-visible:ring-ring h-8 w-full rounded-md border px-2 text-sm outline-none focus-visible:ring-2"
            />
            <SegmentedControl
              aria-label="Loot category"
              options={LOOT_CATEGORIES}
              value={category}
              onChange={setCategory}
            />
            <p aria-live="polite" className="text-muted-foreground text-xs">
              {visible.length === loot.length
                ? countLabel(loot.length)
                : `${String(visible.length)} of ${countLabel(loot.length)}`}
            </p>
          </div>
          {tiers.length === 0 && <p className="text-muted-foreground text-sm">No loot matches.</p>}
          {tiers.map((tier) => {
            // Rare starts collapsed (it's most of the list), except while
            // searching, or when it's the only band left to show.
            const collapsible = tier.tier === "rare" && !searching && tiers.length > 1;
            const expanded = !collapsible || showRare;
            return (
              <div key={tier.tier}>
                <h4 className={cn(SUBHEADING, "flex items-baseline gap-1.5")}>
                  {tier.label}
                  <span className="font-normal normal-case">({tier.range})</span>
                  <span className="ml-auto tabular-nums">{tier.entries.length}</span>
                </h4>
                {collapsible && (
                  <button
                    type="button"
                    aria-expanded={showRare}
                    aria-controls={rareListId}
                    onClick={() => {
                      setShowRare((shown) => !shown);
                    }}
                    className="text-primary focus-visible:ring-ring mt-1 cursor-pointer rounded-sm text-xs font-medium underline-offset-2 outline-none hover:underline focus-visible:ring-2"
                  >
                    {showRare
                      ? "Hide rare items"
                      : `Show ${countLabel(tier.entries.length, "rare")}`}
                  </button>
                )}
                {expanded && (
                  <ul id={tier.tier === "rare" ? rareListId : undefined}>
                    {tier.entries.map((entry) => (
                      <ItemRow
                        key={entry.itemId}
                        itemId={entry.itemId}
                        chance={entry.chance}
                        itemsById={itemsById}
                        chanceContext="in tarkov.dev's data"
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}

interface Props {
  /** The pill whose card is open, or `null` when closed. */
  pill: BossPill | null;
  /** Display name of the map the strip is showing, for the spawn-chance line. */
  mapName: string;
  mobsById: Readonly<Record<string, RawMob>>;
  onClose: () => void;
  /** The pill button that opened the card; focus goes back to it on close. */
  returnFocusTo: RefObject<HTMLButtonElement | null>;
}

/**
 * A boss's gear and loot card, opened from its pill in the Maps boss strip.
 * Header: portrait, this map's spawn chance, and HP. Body: a Gear/Health
 * tabbed column (gear by worn slot, weapons first; or max HP per body part),
 * then loot in Common/Uncommon/Rare bands with a search box and category
 * filter; side by side from `md` up, stacked (gear first) below. Every item
 * row opens the app-wide item detail dialog on top of this one.
 *
 * The Gear/Health tabs sit at the top of their column, while the loot
 * filter stays under the search box rather than being lifted to the same
 * row: each control sits next to what it controls (the filter and search
 * both narrow the same list), the two controls do different jobs (switch a
 * panel vs filter a list), and once the columns stack on a phone a shared
 * row couldn't exist anyway.
 *
 * Focus lands on the card itself rather than its first row (the
 * long-content dialog pattern from the WAI-ARIA authoring guide), so a
 * screen reader starts at the title and nothing gets a stray focus ring.
 * Since the card is opened from state rather than a Radix `DialogTrigger`,
 * Radix doesn't know which button to hand focus back to on close, so
 * `returnFocusTo` does that explicitly.
 */
export function BossLoadoutDialog({ pill, mapName, mobsById, onClose, returnFocusTo }: Props) {
  const { items } = useTarkovIndexes();
  const loadout = pill ? getBossLoadout(pill.mobIds, mobsById) : null;

  return (
    <Dialog
      open={pill !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {pill && (
        <DialogContent
          className={cn(
            "flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 focus:outline-none",
            // A fixed height whenever there's data, so the card never
            // resizes as its content changes (Gear vs Health, expanding
            // Rare, a search narrowing the loot). Sized by content instead,
            // a boss with little loot let the shorter Health tab shrink
            // the vertically centered card and slide the tab bar out from
            // under the cursor. Each column scrolls on its own.
            loadout && "h-[min(90dvh,64rem)]",
          )}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            if (event.currentTarget instanceof HTMLElement) event.currentTarget.focus();
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            returnFocusTo.current?.focus();
          }}
        >
          <DialogHeader className="border-border flex-row items-center gap-3 border-b p-4 pr-12">
            <BossPortrait pill={pill} className="h-14 w-14" />
            <div className="flex min-w-0 flex-col gap-1">
              <DialogTitle>{pill.name}</DialogTitle>
              <DialogDescription>
                <span className={cn("font-semibold", TONE_TEXT[pill.tone])}>
                  {spawnChanceText(pill)} spawn chance
                </span>{" "}
                on {mapName}
                {pill.badge ? ` (${pill.badge.title})` : ""}
                {loadout?.health ? ` · ${loadout.health.toLocaleString("en-US")} HP` : ""}
              </DialogDescription>
              {loadout && loadout.sourceCount > 1 && (
                <p className="text-muted-foreground text-xs">
                  Combined from {loadout.sourceCount} enemy types.
                </p>
              )}
            </div>
          </DialogHeader>
          {loadout ? (
            <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-2 md:overflow-hidden">
              <DetailsColumn loadout={loadout} itemsById={items.byId} />
              <LootSection loot={loadout.loot} itemsById={items.byId} />
            </div>
          ) : (
            <p className="text-muted-foreground p-4 text-sm">
              tarkov.dev has no gear or loot data for this enemy yet.
            </p>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}
