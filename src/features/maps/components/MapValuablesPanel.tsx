"use client";

import { useActiveModeTasks } from "@/features/progress-tracker/hooks/use-active-mode-tasks";
import { useActiveProgress } from "@/features/progress-tracker/hooks/use-active-progress";
import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { calculateFleaNet, calculateFleaTax } from "@/shared/lib/flea-market/flea-tax";
import { formatRoubles, formatRoublesCompact } from "@/shared/lib/format-roubles";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Badge } from "@/shared/ui/badge/Badge";
import { openItemDetail } from "@/shared/ui/item-detail/item-detail-store";
import { useSingleOrDoubleClick } from "@/shared/ui/item-detail/use-single-or-double-click";

import { getMapValuables, searchFleaItems, type ValuableItem } from "../lib/map-valuables";
import { useMapsStore } from "../store";

import type { ProfileMode } from "@/features/progress-tracker/types";

/** Compact roubles for the at-a-glance strip (e.g. "1.18M₽", "37k₽"), or "-" when unknown. The exact value lives in the hover title. */
function abbrevRub(value: number | null): string {
  return value === null ? "-" : formatRoublesCompact(value);
}

/** Exact roubles for hover titles; "no data" when unknown. */
function fullRub(value: number | null): string {
  return value === null ? "no data" : formatRoubles(value);
}

interface RowProps {
  item: ValuableItem;
  /** Active profile's game mode - selects PvP vs PvE flea prices. */
  mode: ProfileMode;
  pinned: boolean;
  onTogglePin: () => void;
}

function ValuableRow({ item, mode, pinned, onTogglePin }: RowProps) {
  // tarkov.dev has no Seasonal-specific flea data - `PVP_SEASONAL` falls
  // through to the same regular price as `PVP`, deliberately, not an
  // oversight.
  const list = mode === "PVE" ? item.avg24hPve : item.avg24hPrice;
  const net = list === null ? null : calculateFleaNet(item.basePrice, list);
  // The flea listing fee (tax to sell here) - shown in place of the 48h %
  // change so the strip carries a second at-a-glance rouble figure.
  const fee = list === null ? null : calculateFleaTax(item.basePrice, list);
  const sells = item.traderSell > 0;
  const traderName = item.traderSellVendor || "Trader";
  const activation = useSingleOrDoubleClick(() => {
    openItemDetail(item.id);
  }, onTogglePin);

  return (
    <button
      type="button"
      onClick={activation.onClick}
      onDoubleClick={activation.onDoubleClick}
      className="border-border bg-popover flex w-full flex-col gap-2 rounded-md border p-2.5 text-left text-[0.92rem] shadow-sm transition duration-150 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-md motion-reduce:transform-none"
      aria-pressed={pinned}
      title="Click for details · double-click to pin/unpin"
    >
      <div className="flex items-center gap-2">
        {item.iconLink && (
          // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon, not a local/optimizable asset.
          <img src={item.iconLink} alt="" className="h-9 w-9 shrink-0 object-contain" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">
            {pinned && <span aria-hidden="true">📌 </span>}
            {item.name}
          </div>
          {item.shortName && (
            <div className="text-muted-foreground truncate text-xs">{item.shortName}</div>
          )}
        </div>
        {item.refs !== undefined && (
          <Badge
            variant="teal"
            title={`Referenced by ${String(item.refs)} of this map's own quests`}
          >
            ×{item.refs}
          </Badge>
        )}
      </div>

      {/* Price strip: flea list price + net-after-tax (green box), then the
          highest-paying trader. Every number is hover-labeled. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span
            className="text-status-amber text-[10px] font-semibold tracking-wide uppercase"
            title={`Flea market (${mode})`}
          >
            Flea
          </span>
          <span
            className="tabular-nums"
            title={`Flea list price (${mode}, 24h avg): ${fullRub(list)}`}
          >
            {abbrevRub(list)}
          </span>
          <span
            className="decoration-status-red tabular-nums underline decoration-2 underline-offset-2"
            title={`Flea listing fee (tax to sell here, ${mode}): ${fullRub(fee)}`}
          >
            {abbrevRub(fee)}
          </span>
          <span
            className="border-status-teal bg-status-teal-soft text-status-teal rounded border px-1 font-semibold tabular-nums"
            title={`Net after flea tax (what you pocket): ${fullRub(net)}`}
          >
            {abbrevRub(net)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className={`text-[10px] font-semibold tracking-wide uppercase ${sells ? "text-status-blue" : "text-muted-foreground"}`}
            title={sells ? "Highest-paying trader" : "No trader buys this"}
          >
            {sells ? traderName : "Trader"}
          </span>
          <span
            className="tabular-nums"
            title={sells ? `${traderName} pays ${fullRub(item.traderSell)}` : "No trader buys this"}
          >
            {sells ? abbrevRub(item.traderSell) : "N/A"}
          </span>
        </div>
      </div>

      {item.locationHint && <div className="text-status-teal text-xs">{item.locationHint}</div>}
    </button>
  );
}

interface Props {
  normalizedName: string;
  /** When set, filters both sections to items whose name matches - fed by the sidebar's shared search box while the Flea Market pane is active. */
  searchQuery?: string;
}

/**
 * The map screen's Valuables panel - "what's worth grabbing on this map,"
 * ported from `old/TarkovTrackerWB-main/src/lib/flea.js`'s
 * `getMapValuables`/`renderValuables`. A separate right-hand panel from
 * `MapSidebar`'s Items/Tasks tabs (per the Phase 5 step 10 plan) - Items
 * shows what the player's own in-progress tasks need, this shows what's
 * generically valuable here regardless of progress. Self-contained, reads
 * live game data/the threshold/pin state itself, matching this feature's
 * other panel components.
 */
export function MapValuablesPanel({ normalizedName, searchQuery = "" }: Props) {
  const { data } = useTarkovGameData();
  const { tasks: activeModeTasks } = useActiveModeTasks();
  const tasks = activeModeTasks ?? [];
  const items = data?.items ?? [];

  const progress = useActiveProgress();
  const togglePinnedItem = useProgressTrackerStore((state) => state.togglePinnedItem);
  // The flea strip shows prices for whichever mode is currently selected -
  // mode is site-wide state now, no longer derived from the active profile.
  const mode = useProgressTrackerStore((state) => state.activeMode);

  const thresholdRub = useMapsStore((state) => state.topDollarThresholdRub);

  const pinnedItemIds = progress?.pinnedItemIds ?? [];

  // With a query, the pane searches EVERY item's flea price (like the OG's
  // `val-search`); cleared, it falls back to this map's own valuables.
  const query = searchQuery.trim();
  const searching = query.length > 0;
  const results = searching ? searchFleaItems(items, normalizedName, searchQuery, 80) : [];
  const raw = searching
    ? { mapSignature: [] as readonly ValuableItem[], topDollar: [] as readonly ValuableItem[] }
    : getMapValuables(tasks, items, normalizedName, thresholdRub);

  // Pinned items float to the top of each section (stable, so the price
  // order is preserved within pinned/unpinned) - but only in the map's own
  // list, never while searching all items.
  const pins = new Set(pinnedItemIds);
  const pinnedFirst = (list: readonly ValuableItem[]): readonly ValuableItem[] =>
    [...list].sort((a, b) => Number(pins.has(b.id)) - Number(pins.has(a.id)));
  const mapSignature = pinnedFirst(raw.mapSignature);
  const topDollar = pinnedFirst(raw.topDollar);

  function rowFor(item: ValuableItem) {
    return (
      <ValuableRow
        key={item.id}
        item={item}
        mode={mode}
        pinned={pinnedItemIds.includes(item.id)}
        onTogglePin={() => {
          togglePinnedItem(item.id);
        }}
      />
    );
  }

  const labelClass =
    "bg-card/90 rounded-md px-2 py-1 text-xs font-semibold tracking-wide uppercase backdrop-blur-sm";
  const emptyClass =
    "text-muted-foreground bg-card/90 rounded-md px-2 py-1 text-xs backdrop-blur-sm";

  if (searching) {
    return (
      <div className="flex flex-col gap-2 p-2 text-sm">
        <span className={`text-muted-foreground ${labelClass}`}>
          {results.length} result{results.length === 1 ? "" : "s"} for &ldquo;{query}&rdquo;
          {results.length >= 80 ? " (top 80)" : ""}
        </span>
        {results.length === 0 ? <p className={emptyClass}>No items match.</p> : results.map(rowFor)}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-2 text-sm">
      <div className="flex flex-col gap-2">
        <span className={`text-status-teal ${labelClass}`}>◆ Map Signature</span>
        {mapSignature.length === 0 ? (
          <p className={emptyClass}>No quest-signature items on this map.</p>
        ) : (
          mapSignature.map(rowFor)
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className={`text-status-amber ${labelClass}`}>★ Top Dollar</span>
        {topDollar.length === 0 ? (
          <p className={emptyClass}>No items at or above this threshold on the flea market.</p>
        ) : (
          topDollar.map(rowFor)
        )}
      </div>
    </div>
  );
}
