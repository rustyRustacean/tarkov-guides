"use client";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Badge } from "@/shared/ui/badge/Badge";

import { getMapValuables, type ValuableItem } from "../lib/map-valuables";
import { useMapsStore } from "../store";

const inputClassName =
  "border-border bg-background focus-visible:ring-ring w-20 rounded-md border px-2 py-1 text-sm focus-visible:ring-2 focus-visible:outline-none";

function formatRub(value: number | null): string {
  return value === null ? "-" : `${Math.round(value).toLocaleString()}₽`;
}

interface RowProps {
  item: ValuableItem;
  pinned: boolean;
  onTogglePin: () => void;
}

function ValuableRow({ item, pinned, onTogglePin }: RowProps) {
  return (
    <button
      type="button"
      onDoubleClick={onTogglePin}
      className="border-border bg-card flex w-full items-center gap-3 rounded-md border p-2 text-left text-sm"
      aria-pressed={pinned}
      title="Double-click to pin/unpin"
    >
      {item.iconLink && (
        // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon, not a local/optimizable asset.
        <img src={item.iconLink} alt="" className="h-8 w-8 shrink-0 object-contain" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">
            {pinned && <span aria-hidden="true">📌 </span>}
            {item.name}
          </span>
          {item.refs !== undefined && (
            <Badge
              variant="teal"
              title={`Referenced by ${String(item.refs)} of this map's own quests`}
            >
              ×{item.refs}
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground mt-0.5 text-xs">
          {formatRub(item.avg24hPrice)} avg
          {item.locationHint && <> · {item.locationHint}</>}
        </div>
      </div>
    </button>
  );
}

interface Props {
  normalizedName: string;
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
export function MapValuablesPanel({ normalizedName }: Props) {
  const { data } = useTarkovGameData();
  const tasks = data?.tasks ?? [];
  const items = data?.items ?? [];

  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const progress = useProgressTrackerStore((state) =>
    activeProfileId !== null ? state.progressByProfile[activeProfileId] : undefined,
  );
  const togglePinnedItem = useProgressTrackerStore((state) => state.togglePinnedItem);

  const thresholdRub = useMapsStore((state) => state.topDollarThresholdRub);
  const setTopDollarThreshold = useMapsStore((state) => state.setTopDollarThreshold);

  const pinnedItemIds = progress?.pinnedItemIds ?? [];
  const { mapSignature, topDollar } = getMapValuables(tasks, items, normalizedName, thresholdRub);

  function rowFor(item: ValuableItem) {
    return (
      <ValuableRow
        key={item.id}
        item={item}
        pinned={pinnedItemIds.includes(item.id)}
        onTogglePin={() => {
          togglePinnedItem(item.id);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 p-2 text-sm">
      <label className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">Min. 24h avg price (k₽)</span>
        <input
          type="number"
          min={1}
          step={5}
          value={Math.round(thresholdRub / 1000)}
          onChange={(event) => {
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed) && parsed > 0) setTopDollarThreshold(parsed * 1000);
          }}
          className={inputClassName}
          aria-label="Minimum 24h average price in thousands of roubles"
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          ◆ Map Signature
        </span>
        {mapSignature.length === 0 ? (
          <p className="text-muted-foreground text-xs">No quest-signature items on this map.</p>
        ) : (
          mapSignature.map(rowFor)
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          ★ Top Dollar
        </span>
        {topDollar.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No items at or above this threshold on the flea market.
          </p>
        ) : (
          topDollar.map(rowFor)
        )}
      </div>
    </div>
  );
}
