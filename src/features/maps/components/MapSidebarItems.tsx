import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { Badge } from "@/shared/ui/badge/Badge";

import type { TrackedItem } from "@/features/progress-tracker/selectors/item-progress";

interface RowProps {
  item: TrackedItem;
}

function ItemSidebarRow({ item }: RowProps) {
  const togglePinnedItem = useProgressTrackerStore((state) => state.togglePinnedItem);

  return (
    <button
      type="button"
      onDoubleClick={() => {
        togglePinnedItem(item.id);
      }}
      className="border-border bg-card flex w-full items-center gap-3 rounded-md border p-2 text-left text-sm"
      aria-pressed={item.pinned}
      title="Double-click to pin/unpin"
    >
      {item.iconLink && (
        // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon, not a local/optimizable asset.
        <img src={item.iconLink} alt="" className="h-8 w-8 shrink-0 object-contain" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium">
            {item.pinned && <span aria-hidden="true">📌 </span>}
            {item.name}
          </span>
          {item.foundInRaid && <Badge variant="amber">FIR</Badge>}
        </div>
        <div className="text-muted-foreground mt-0.5 text-xs">
          Need {item.need} · Have {item.have} · Remaining {item.remaining}
        </div>
      </div>
    </button>
  );
}

interface Props {
  items: readonly TrackedItem[];
  customItems: readonly TrackedItem[];
  mapDisplayName: string;
}

/**
 * The sidebar's Items pane - ported from `old/TarkovTrackerWB-main/src/
 * components/maps/mapSidebar.js`'s `renderMapItems`. `items` (from
 * `getMapTrackedItems`) and `customItems` (always shown, any map) are kept
 * as separate props rather than merged here so the caller's data-fetching
 * stays the single source of truth for what counts as "custom" - matches
 * legacy's own visual split (a "◆ CUSTOM ITEMS" divider below the map-scoped
 * rows).
 */
export function MapSidebarItems({ items, customItems, mapDisplayName }: Props) {
  if (items.length === 0 && customItems.length === 0) {
    return (
      <div className="text-muted-foreground p-4 text-center text-sm">
        No active items for {mapDisplayName}
        <br />
        <span className="text-xs">Start a task below, or add a custom item from the top bar</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {items.map((item) => (
        <ItemSidebarRow key={item.id} item={item} />
      ))}
      {customItems.length > 0 && (
        <>
          <div className="border-border mt-2 flex items-center justify-between border-t pt-2 text-xs">
            <span className="text-status-violet font-semibold tracking-wide uppercase">
              ◆ Custom Items
            </span>
            <span className="text-muted-foreground">{customItems.length}</span>
          </div>
          {customItems.map((item) => (
            <ItemSidebarRow key={item.id} item={item} />
          ))}
        </>
      )}
    </div>
  );
}
