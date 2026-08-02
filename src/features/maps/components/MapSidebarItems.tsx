import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { Badge } from "@/shared/ui/badge/Badge";
import { openItemDetail } from "@/shared/ui/item-detail/item-detail-store";
import { useSingleOrDoubleClick } from "@/shared/ui/item-detail/use-single-or-double-click";

import type { TrackedItem } from "@/features/progress-tracker/selectors/item-progress";

interface RowProps {
  item: TrackedItem;
}

function ItemSidebarRow({ item }: RowProps) {
  const togglePinnedItem = useProgressTrackerStore((state) => state.togglePinnedItem);
  const activation = useSingleOrDoubleClick(
    () => {
      openItemDetail(item.id);
    },
    () => {
      togglePinnedItem(item.id);
    },
  );

  return (
    <button
      type="button"
      onClick={activation.onClick}
      onDoubleClick={activation.onDoubleClick}
      className="border-border bg-popover flex w-full items-center gap-3 rounded-md border p-2 text-left text-sm shadow-sm"
      aria-pressed={item.pinned}
      title="Click for details · double-click to pin/unpin"
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
  /** When set, filters both lists to items whose name matches - fed by the sidebar's shared search box while the Items pane is active. */
  searchQuery?: string;
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
export function MapSidebarItems({ items, customItems, mapDisplayName, searchQuery = "" }: Props) {
  const query = searchQuery.trim().toLowerCase();
  // Pinned items float to the top (stable, preserving the existing order
  // within pinned/unpinned).
  const pinnedFirst = (list: readonly TrackedItem[]): readonly TrackedItem[] =>
    [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  const shownItems = pinnedFirst(
    query ? items.filter((item) => item.name.toLowerCase().includes(query)) : items,
  );
  const shownCustom = pinnedFirst(
    query ? customItems.filter((item) => item.name.toLowerCase().includes(query)) : customItems,
  );

  if (shownItems.length === 0 && shownCustom.length === 0) {
    return (
      <div className="text-muted-foreground bg-card/90 m-2 rounded-md p-4 text-center text-sm backdrop-blur-sm">
        {query ? (
          <>No items match &ldquo;{searchQuery.trim()}&rdquo;</>
        ) : (
          <>
            No active items for {mapDisplayName}
            <br />
            <span className="text-xs">
              Start a task below, or add a custom item from the top bar
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {shownItems.map((item) => (
        <ItemSidebarRow key={item.id} item={item} />
      ))}
      {shownCustom.length > 0 && (
        <>
          <div className="bg-card/90 mt-1 flex items-center justify-between rounded-md px-2 py-1 text-xs backdrop-blur-sm">
            <span className="text-status-violet font-semibold tracking-wide uppercase">
              ◆ Custom Items
            </span>
            <span className="text-muted-foreground">{shownCustom.length}</span>
          </div>
          {shownCustom.map((item) => (
            <ItemSidebarRow key={item.id} item={item} />
          ))}
        </>
      )}
    </div>
  );
}
