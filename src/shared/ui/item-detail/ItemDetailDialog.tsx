"use client";

import { useMemo } from "react";

import { ITEM_LOCATIONS } from "@/shared/data/item-locations";
import { calculateFleaNet, calculateFleaTax } from "@/shared/lib/flea-market/flea-tax";
import { findItemLocationEntry } from "@/shared/lib/item-resolution/find-item-location-entry";
import {
  buildBarterCraftIndexes,
  buildHideoutByItem,
  buildTasksByItemShortName,
} from "@/shared/lib/tarkov-api/indexes";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";

import { useItemDetailStore } from "./item-detail-store";

import type {
  NormalizedItem,
  RawBarter,
  RawBarterCraftItemRef,
  RawCraft,
} from "@/shared/lib/tarkov-api/types";
import type { ReactNode } from "react";

/** Exact roubles, or "N/A" for a missing/zero price (matches legacy `fmtTraderPrice`). */
function fmtRub(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "N/A";
  return `${Math.round(value).toLocaleString()}₽`;
}

/** Pretty display names for the normalized map keys used in the where-to-find per-map list. */
const MAP_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  customs: "Customs",
  factory: "Factory",
  interchange: "Interchange",
  lighthouse: "Lighthouse",
  reserve: "Reserve",
  shoreline: "Shoreline",
  "streets-of-tarkov": "Streets of Tarkov",
  woods: "Woods",
  "ground-zero": "Ground Zero",
  "the-lab": "The Lab",
  "the-labyrinth": "The Labyrinth",
};

/** One labelled price readout in the header (e.g. "flea avg 82,000₽"). */
function PriceStat({
  label,
  value,
  tone,
  title,
}: {
  label: string;
  value: string;
  tone?: string;
  title?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3" title={title}>
      <span className="text-muted-foreground text-[10px] font-semibold tracking-wide uppercase">
        {label}
      </span>
      <span className={`tabular-nums ${tone ?? ""}`}>{value}</span>
    </div>
  );
}

interface SectionProps {
  title: string;
  count: number;
  tone?: string;
  children: ReactNode;
}

/** A conditional, titled card section - renders nothing when `count` is 0, so empty sections don't clutter. */
function DetailSection({ title, count, tone, children }: SectionProps) {
  if (count === 0) return null;
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 p-4 pb-1.5">
        <CardTitle
          className={`text-xs font-semibold tracking-wide uppercase ${tone ?? "text-muted-foreground"}`}
        >
          {title}
        </CardTitle>
        <Badge variant="outline">{count}</Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-4 pt-0 text-sm">{children}</CardContent>
    </Card>
  );
}

/**
 * The item-detail popup, mounted once app-wide (see `app/providers.tsx`) and
 * driven by {@link useItemDetailStore}. Ported from legacy `modals.js`'s
 * `openItemModal`: a price header (flea avg + tax/net, flea low, trader
 * buy/sell) followed by conditional "what can I do with this item" sections
 * - tasks requiring it, hideout builds needing it, crafts producing/consuming
 * it, barters for/with it, quest offer-unlocks - then a curated where-to-find
 * block and a wiki link. Item chips inside barter/craft rows and task rows are
 * clickable, drilling into another item/task popup via the store's nav stack
 * (a Back button walks it in reverse), matching legacy's drilldown chrome.
 *
 * Prices shown are PvP (`avg24hPrice`/`lastLowPrice`), matching legacy's item
 * modal. This component intentionally imports nothing from any feature so it
 * can open from anywhere; task clicks are handed back to the store, whose
 * `QuestDetailDialog` is mounted at the app layer.
 */
export function ItemDetailDialog() {
  const current = useItemDetailStore((state) => state.current);
  const hasHistory = useItemDetailStore((state) => state.stack.length > 0);
  const openItem = useItemDetailStore((state) => state.openItem);
  const openTask = useItemDetailStore((state) => state.openTask);
  const back = useItemDetailStore((state) => state.back);
  const close = useItemDetailStore((state) => state.close);

  const { data } = useTarkovGameData();

  const itemsById = useMemo(() => {
    const map: Record<string, NormalizedItem> = {};
    for (const item of data?.items ?? []) map[item.id] = item;
    return map;
  }, [data?.items]);

  const barterCraft = useMemo(
    () => buildBarterCraftIndexes(data?.barters ?? [], data?.crafts ?? []),
    [data?.barters, data?.crafts],
  );
  const tasksByShortName = useMemo(
    () => buildTasksByItemShortName(data?.tasks ?? []),
    [data?.tasks],
  );
  const hideoutByItem = useMemo(
    () => buildHideoutByItem(data?.hideoutStations ?? []),
    [data?.hideoutStations],
  );
  const tasksById = useMemo(() => {
    const map = new Map((data?.tasks ?? []).map((task) => [task.id, task]));
    return map;
  }, [data?.tasks]);

  const open = current?.type === "item";
  const item = open ? itemsById[current.id] : undefined;

  /**
   * A clickable item chip - `count× shortName`, drilling into that item's
   * popup. The `output` variant (the item a barter/craft produces) is drawn
   * larger with a gold accent so the result reads first and grabs the eye,
   * mirroring the in-game crafting bar's emphasized output tile; `ingredient`
   * is the small neutral input chip.
   */
  function itemChip(
    ref: RawBarterCraftItemRef,
    keyPrefix: string,
    variant: "output" | "ingredient" = "ingredient",
  ) {
    const label = ref.item.shortName || ref.item.name || "item";
    const known = ref.item.id in itemsById;
    const output = variant === "output";
    const content = (
      <>
        {ref.item.iconLink && (
          // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon, not a local/optimizable asset.
          <img
            src={ref.item.iconLink}
            alt=""
            className={`${output ? "h-7 w-7" : "h-4 w-4"} shrink-0 object-contain`}
          />
        )}
        <span className="truncate">
          {ref.count}× {label}
        </span>
      </>
    );
    const className = output
      ? "border-status-amber bg-status-amber-soft text-status-amber inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-sm font-semibold"
      : "border-border bg-background inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-xs";
    if (!known) {
      return (
        <span key={`${keyPrefix}-${ref.item.id}`} className={className} title={ref.item.name}>
          {content}
        </span>
      );
    }
    return (
      <button
        key={`${keyPrefix}-${ref.item.id}`}
        type="button"
        className={`${className} ${output ? "hover:border-status-amber hover:brightness-110" : "hover:border-status-blue"} text-left`}
        title={`${ref.item.name} - view details`}
        onClick={() => {
          openItem(ref.item.id);
        }}
      >
        {content}
      </button>
    );
  }

  /** The output-first row shared by barter/craft sections: `result = ingredients`. */
  function exchangeRow(
    subtitle: ReactNode,
    rewardItems: readonly RawBarterCraftItemRef[],
    requiredItems: readonly RawBarterCraftItemRef[],
    rowKey: string,
  ) {
    return (
      <div key={rowKey} className="flex flex-col gap-1.5">
        <div className="text-muted-foreground text-xs">{subtitle}</div>
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {rewardItems.map((ref) => itemChip(ref, `${rowKey}-out`, "output"))}
          <span className="text-muted-foreground px-1 text-base font-semibold">=</span>
          {requiredItems.map((ref) => itemChip(ref, `${rowKey}-in`, "ingredient"))}
        </div>
      </div>
    );
  }

  function barterRow(barter: RawBarter, keyPrefix: string) {
    return exchangeRow(
      <>
        <span className="text-foreground font-medium">{barter.trader.name}</span> · LL{barter.level}
      </>,
      barter.rewardItems,
      barter.requiredItems,
      `${keyPrefix}-${barter.id}`,
    );
  }

  function craftRow(craft: RawCraft, keyPrefix: string) {
    const minutes = craft.duration > 0 ? Math.round(craft.duration / 60) : null;
    return exchangeRow(
      <>
        <span className="text-foreground font-medium">{craft.station.name}</span> L{craft.level}
        {minutes !== null && ` · ${String(minutes)}m`}
      </>,
      craft.rewardItems,
      craft.requiredItems,
      `${keyPrefix}-${craft.id}`,
    );
  }

  // ── Connections for the open item (empty when nothing's open) ──
  const tasksUsing = item ? (tasksByShortName[item.shortName] ?? []) : [];
  const hideoutUses = item ? (hideoutByItem[item.id] ?? []) : [];
  const craftInputs = item ? (barterCraft.craftInputs[item.id] ?? []) : [];
  const craftRewards = item ? (barterCraft.craftRewards[item.id] ?? []) : [];
  const barterInputs = item ? (barterCraft.barterInputs[item.id] ?? []) : [];
  const barterRewards = item ? (barterCraft.barterRewards[item.id] ?? []) : [];
  // Quest offer-unlocks: a trader buy offer gated behind a task means that
  // task unlocks the ability to purchase this item.
  const unlockOffers = item ? item.buyOffers.filter((offer) => offer.taskUnlockId !== "") : [];
  const locationResult = item ? findItemLocationEntry(item, ITEM_LOCATIONS) : undefined;

  const listPrice = item ? (item.lastLowPrice ?? item.avg24hPrice ?? 0) : 0;
  const showTax = Boolean(item?.basePrice && listPrice);
  const tax = showTax && item ? calculateFleaTax(item.basePrice, listPrice) : 0;
  const net = showTax && item ? calculateFleaNet(item.basePrice, listPrice) : 0;
  const change = item?.changeLast48hPercent ?? null;

  const totalConnections =
    tasksUsing.length +
    hideoutUses.length +
    craftInputs.length +
    craftRewards.length +
    barterInputs.length +
    barterRewards.length +
    unlockOffers.length;

  const wikiFallback = item
    ? `https://escapefromtarkov.fandom.com/wiki/${encodeURIComponent(
        (item.name || item.shortName).replace(/\s+/g, "_"),
      )}`
    : "";
  const wikiHref = item?.wikiLink ?? wikiFallback;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item?.name ?? "Item"}</DialogTitle>
        </DialogHeader>

        {!item ? (
          <p className="text-muted-foreground mt-4 text-sm">
            {open ? "Item not found in the current game data." : ""}
          </p>
        ) : (
          <div className="mt-2 flex flex-col gap-5 text-sm">
            {/* Header: icon + identity + price block */}
            <div className="flex items-start gap-4">
              <div className="border-border bg-background flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md border">
                {item.iconLink && (
                  // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon, not a local/optimizable asset.
                  <img src={item.iconLink} alt="" className="h-full w-full object-contain" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-muted-foreground text-xs tracking-wide uppercase">
                  {item.shortName}
                  {item.types.length > 0 && ` · ${item.types.join(", ")}`}
                </div>
              </div>
              <div className="w-44 shrink-0 flex-col gap-0.5">
                <PriceStat
                  label="flea avg"
                  value={fmtRub(item.avg24hPrice)}
                  title="Flea market 24h average (PvP)"
                />
                {showTax && (
                  <>
                    <PriceStat
                      label="tax"
                      value={`−${fmtRub(tax)}`}
                      tone="text-status-red"
                      title="Flea market tax at the current list price (BSG formula, no Intel/Hideout Management discounts)"
                    />
                    <PriceStat
                      label="net"
                      value={fmtRub(net)}
                      tone="text-status-green"
                      title="What you actually pocket after flea tax"
                    />
                  </>
                )}
                <PriceStat label="flea low" value={fmtRub(item.lastLowPrice)} />
                {change !== null && change !== 0 && (
                  <PriceStat
                    label="48h"
                    value={`${change > 0 ? "↑" : "↓"}${Math.abs(change).toFixed(1)}%`}
                    tone={change > 0 ? "text-status-teal" : "text-status-red"}
                  />
                )}
                <PriceStat
                  label={item.traderBuyVendor || "trader buy"}
                  value={fmtRub(item.traderBuy)}
                  tone="text-status-blue"
                  title="Cheapest trader that sells this item to you"
                />
                <PriceStat
                  label={item.traderSellVendor || "trader sell"}
                  value={fmtRub(item.traderSell)}
                  tone="text-status-green"
                  title="Highest-paying trader"
                />
              </div>
            </div>

            {totalConnections === 0 && !locationResult ? (
              <p className="text-muted-foreground text-center text-xs">
                Nothing in the current data references this item.
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailSection
                  title="Unlocked by task"
                  count={unlockOffers.length}
                  tone="text-status-amber"
                >
                  {unlockOffers.map((offer, index) => {
                    const taskName =
                      offer.taskUnlockName !== ""
                        ? offer.taskUnlockName
                        : (tasksById.get(offer.taskUnlockId)?.name ?? "Task");
                    return (
                      <div key={`unlock-${offer.taskUnlockId}-${String(index)}`}>
                        <button
                          type="button"
                          className="hover:underline"
                          onClick={() => {
                            openTask(offer.taskUnlockId);
                          }}
                        >
                          {taskName}
                        </button>
                        <div className="text-muted-foreground text-xs">
                          unlocks at {offer.vendor}
                          {offer.minTraderLevel > 0 && ` LL${String(offer.minTraderLevel)}`}
                        </div>
                      </div>
                    );
                  })}
                </DetailSection>

                <DetailSection
                  title="Required by task"
                  count={tasksUsing.length}
                  tone="text-status-amber"
                >
                  {tasksUsing.map((task) => (
                    <button
                      key={`task-${task.id}`}
                      type="button"
                      className="text-left hover:underline"
                      onClick={() => {
                        openTask(task.id);
                      }}
                    >
                      <span className="font-medium">{task.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        · {task.trader.name}
                        {task.maps.length > 0 &&
                          ` · ${task.maps.map((key) => MAP_DISPLAY_NAMES[key] ?? key).join(", ")}`}
                      </span>
                    </button>
                  ))}
                </DetailSection>

                <DetailSection
                  title="Needed for hideout"
                  count={hideoutUses.length}
                  tone="text-status-teal"
                >
                  {hideoutUses.map((use) => (
                    <div key={`hideout-${use.stationId}-${String(use.level)}`}>
                      <span className="font-medium">{use.stationName}</span> L{use.level}
                      <span className="text-muted-foreground text-xs"> · needs {use.count}</span>
                    </div>
                  ))}
                </DetailSection>

                <DetailSection
                  title="Produced by craft"
                  count={craftRewards.length}
                  tone="text-status-violet"
                >
                  {craftRewards.map((craft) => craftRow(craft, "craft-out"))}
                </DetailSection>

                <DetailSection
                  title="Used in craft"
                  count={craftInputs.length}
                  tone="text-status-violet"
                >
                  {craftInputs.map((craft) => craftRow(craft, "craft-in"))}
                </DetailSection>

                <DetailSection title="Obtainable via barter" count={barterRewards.length}>
                  {barterRewards.map((barter) => barterRow(barter, "barter-out"))}
                </DetailSection>

                <DetailSection title="Traded away in barter" count={barterInputs.length}>
                  {barterInputs.map((barter) => barterRow(barter, "barter-in"))}
                </DetailSection>
              </div>
            )}

            {locationResult && (
              <div className="flex flex-col gap-1">
                <span className="text-status-teal text-xs font-semibold tracking-wide uppercase">
                  Where to find
                </span>
                <p className="text-muted-foreground text-sm">{locationResult.entry.general}</p>
                {Object.entries(locationResult.entry.perMap).length > 0 && (
                  <ul className="mt-1 flex flex-col gap-1">
                    {Object.entries(locationResult.entry.perMap).map(([mapKey, hint]) => (
                      <li key={mapKey} className="text-sm">
                        <span className="font-medium">{MAP_DISPLAY_NAMES[mapKey] ?? mapKey}:</span>{" "}
                        <span className="text-muted-foreground">{hint}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {wikiHref && (
              <a
                href={wikiHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-status-blue hover:underline"
              >
                Wiki page
              </a>
            )}
          </div>
        )}

        <DialogFooter>
          {hasHistory && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                back();
              }}
            >
              ← Back
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              close();
            }}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
