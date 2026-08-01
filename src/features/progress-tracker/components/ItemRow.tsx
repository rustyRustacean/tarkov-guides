import { Minus, Pin, Plus } from "lucide-react";
import { useState } from "react";

import { ITEM_LOCATIONS } from "@/shared/data/item-locations";
import { calculateFleaNet, calculateFleaTax } from "@/shared/lib/flea-market/flea-tax";
import { isMoneyItem } from "@/shared/lib/flea-market/item-predicates";
import { findItemLocationEntry } from "@/shared/lib/item-resolution/find-item-location-entry";
import { Badge } from "@/shared/ui/badge/Badge";
import { Button } from "@/shared/ui/button/Button";
import { openItemDetail } from "@/shared/ui/item-detail/item-detail-store";
import { useSingleOrDoubleClick } from "@/shared/ui/item-detail/use-single-or-double-click";

import type { TrackedItem } from "../selectors/item-progress";
import type { NormalizedItem, RawMap } from "@/shared/lib/tarkov-api/types";

const inputClassName =
  "border-border bg-background focus-visible:ring-ring w-16 rounded-md border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none";

function parseNonNegativeInt(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function formatRub(value: number): string {
  return `${Math.round(value).toLocaleString()}₽`;
}

/**
 * Flea tax/net readout for one item, computed at the item's current low
 * price (falling back to the 24h average when no low price is cached) -
 * matches legacy `modals.js`'s item-detail modal, which computes tax at the
 * live listing price rather than taking a user-entered price. Renders
 * nothing when either `basePrice` or a usable list price is unavailable
 * (matches legacy's own "only show when we have both" guard).
 */
function ItemFleaInfo({ catalogItem }: { catalogItem: NormalizedItem }) {
  const listPrice = catalogItem.lastLowPrice ?? catalogItem.avg24hPrice ?? 0;
  if (!catalogItem.basePrice || !listPrice) return null;

  const tax = calculateFleaTax(catalogItem.basePrice, listPrice);
  const net = calculateFleaNet(catalogItem.basePrice, listPrice);

  return (
    <span title="Flea market tax at the current low price - BSG formula, no Intel Center/Hideout Management discounts applied">
      Flea {formatRub(listPrice)} · tax −{formatRub(tax)} · net {formatRub(net)}
    </span>
  );
}

/**
 * Expandable "where to find this item" hint, resolved from the curated
 * `ITEM_LOCATIONS` dataset via `findItemLocationEntry`. Renders nothing
 * when the item has no curated entry. Collapsed by default since per-map
 * hints can run long - matches this feature's existing "hidden behind a
 * toggle" convention (`ItemTrackerBoard`'s Collected section).
 */
function ItemLocationHint({
  catalogItem,
  maps,
}: {
  catalogItem: NormalizedItem;
  maps: readonly RawMap[];
}) {
  const [expanded, setExpanded] = useState(false);
  const result = findItemLocationEntry(catalogItem, ITEM_LOCATIONS);
  if (!result) return null;

  const perMapHints = Object.entries(result.entry.perMap);
  const mapNameByNormalizedName = new Map(maps.map((map) => [map.normalizedName, map.name]));

  return (
    <div>
      <button
        type="button"
        className="underline-offset-2 hover:underline"
        aria-expanded={expanded}
        onClick={() => {
          setExpanded((current) => !current);
        }}
      >
        Where to find {expanded ? "▲" : "▼"}
      </button>
      {expanded && (
        <div className="mt-1 max-w-sm">
          <p>{result.entry.general}</p>
          {perMapHints.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {perMapHints.map(([mapKey, hint]) => (
                <li key={mapKey}>
                  <span className="font-medium">
                    {mapNameByNormalizedName.get(mapKey) ?? mapKey}:
                  </span>{" "}
                  {hint}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export interface ItemRowProps {
  item: TrackedItem;
  /**
   * The live catalog entry for this item, resolved by the caller against
   * `useTarkovGameData()`'s `items` - drives the money-item stepper swap,
   * the flea tax/net readout, and the location-hint lookup. `undefined`
   * when the item isn't found in the current catalog (e.g. a stale/removed
   * item), in which case none of those three render.
   */
  catalogItem: NormalizedItem | undefined;
  /** Live map roster, used only to render a curated location hint's map keys as real map names. */
  maps: readonly RawMap[];
  onAdjustPending: (itemId: string, delta: number) => void;
  onEditStash: (itemId: string, name: string, count: number) => void;
  onFillMoney: (itemId: string, need: number, direction: 1 | -1) => void;
  onTogglePin: (itemId: string) => void;
  onRemoveCustom: (id: string, name: string) => void;
}

/**
 * One tracked-item row: icon, name, FIR badge, need/have/remaining, a
 * stash-count editor, and the pending stepper (or money Fill/Clear for
 * currency items). Double-click on the name still toggles pin (a mouse
 * shortcut), plus a real, single-click, keyboard-reachable Pin toggle
 * button - unlike `QuestCard`, whose detail dialog offers a second,
 * reachable pin control, this row has no other pin entry point anywhere in
 * the app, so double-click alone (no keyboard/screen-reader equivalent -
 * browsers don't synthesize `dblclick` from repeated Enter/Space) would
 * otherwise be the only way to pin/unpin a tracked item at all.
 */
export function ItemRow({
  item,
  catalogItem,
  maps,
  onAdjustPending,
  onEditStash,
  onFillMoney,
  onTogglePin,
  onRemoveCustom,
}: ItemRowProps) {
  const isMoney = catalogItem ? isMoneyItem(catalogItem) : false;
  const activation = useSingleOrDoubleClick(
    () => {
      openItemDetail(item.id);
    },
    () => {
      onTogglePin(item.id);
    },
  );

  return (
    <li className="border-border bg-card flex flex-col gap-2 rounded-md border p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={activation.onClick}
          onDoubleClick={activation.onDoubleClick}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-pressed={item.pinned}
          title="Click for details · double-click to pin/unpin"
        >
          {item.iconLink && (
            // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icons, not a local/optimizable asset.
            <img src={item.iconLink} alt="" className="h-8 w-8 shrink-0 object-contain" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium">
                {item.pinned && <span aria-hidden="true">📌 </span>}
                {item.name}
              </span>
              {item.foundInRaid && <Badge variant="amber">FIR</Badge>}
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              Need {item.need} · Remaining {item.remaining}
            </div>
          </div>
        </button>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`${item.pinned ? "Unpin" : "Pin"} ${item.name}`}
          aria-pressed={item.pinned}
          onClick={() => {
            onTogglePin(item.id);
          }}
        >
          <Pin
            className="h-4 w-4"
            aria-hidden="true"
            fill={item.pinned ? "currentColor" : "none"}
          />
        </Button>

        <label className="flex shrink-0 items-center gap-1.5 text-xs">
          Have
          <input
            type="number"
            min={0}
            value={item.have}
            onChange={(event) => {
              onEditStash(item.id, item.name, parseNonNegativeInt(event.target.value, item.have));
            }}
            className={inputClassName}
          />
        </label>

        {isMoney ? (
          <div className="flex shrink-0 gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                onFillMoney(item.id, item.need, 1);
              }}
            >
              Fill Remaining
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                onFillMoney(item.id, item.need, -1);
              }}
            >
              Clear
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label={`Decrease pending ${item.name}`}
              onClick={() => {
                onAdjustPending(item.id, -1);
              }}
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </Button>
            <span className="w-6 text-center">{item.pending}</span>
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label={`Increase pending ${item.name}`}
              onClick={() => {
                onAdjustPending(item.id, 1);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}

        {item.isCustom && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              onRemoveCustom(item.id, item.name);
            }}
          >
            Remove
          </Button>
        )}
      </div>
      {catalogItem && (
        <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 pl-11 text-xs">
          <ItemFleaInfo catalogItem={catalogItem} />
          <ItemLocationHint catalogItem={catalogItem} maps={maps} />
        </div>
      )}
    </li>
  );
}
