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

import {
  LOOT_CATEGORIES,
  LOOT_TIERS,
  filterLoot,
  formatChance,
  getBossLoadout,
  lootTier,
} from "../lib/boss-loadout";

import { BossPortrait, TONE_TEXT, spawnChanceText } from "./BossStrip";

import type { BossPill } from "../lib/boss-groups";
import type { BossGearSlot, BossLootEntry, LootCategory } from "../lib/boss-loadout";
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
  /** Spoken after the chance, e.g. "of spawns". */
  chanceContext: string;
  /** Optional second line (a weapon's loaded rounds). */
  detail?: string | undefined;
}

/** One item with its chance; clicking opens the app-wide item detail dialog (flea price, quest and hideout use). */
function ItemRow({ itemId, chance, itemsById, chanceContext, detail }: ItemRowProps) {
  const item = itemsById[itemId];
  const name = item?.name ?? itemId;
  const chanceLabel = formatChance(chance);
  return (
    <li>
      <button
        type="button"
        onClick={() => {
          openItemDetail(itemId);
        }}
        aria-label={`${name}, ${chanceLabel} ${chanceContext}${detail ? `. ${detail}` : ""}`}
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

interface GearSectionProps {
  gear: readonly BossGearSlot[];
  samples: number;
  itemsById: ItemsById;
}

function GearSection({ gear, samples, itemsById }: GearSectionProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 p-4 md:min-h-0 md:overflow-y-auto"
    >
      <div>
        <h3 id={headingId} className={SECTION_HEADING}>
          Gear
        </h3>
        <p className="text-muted-foreground text-xs">
          {samples > 0
            ? `How often each item showed up across ${String(samples)} recorded spawns.`
            : "No gear data for this enemy yet."}
        </p>
      </div>
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
                chanceContext="of spawns"
                detail={ammoDetail(option.ammoItemIds, itemsById)}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
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
            ? "Share of recorded spawns carrying each item."
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
                        chanceContext="of spawns carry it"
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
 * Header: portrait, this map's spawn chance, and HP. Body: gear by worn slot
 * (weapons first), then loot in Common/Uncommon/Rare bands with a search box
 * and category filter; side by side from `md` up, stacked (gear first) below.
 * Every row opens the app-wide item detail dialog on top of this one.
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
          className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 focus:outline-none"
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
              <GearSection
                gear={loadout.gear}
                samples={loadout.gearSamples}
                itemsById={items.byId}
              />
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
