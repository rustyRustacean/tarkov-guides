"use client";

import { TriangleAlert, X } from "lucide-react";

import { useGameDataBannerStore } from "@/shared/lib/tarkov-api/game-data-banner-store";
import { useGameDataBannerVisible } from "@/shared/lib/tarkov-api/use-game-data-banner-visible";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { cn } from "@/shared/ui/lib/cn";

/**
 * Global status strip for the shared tarkov.dev game-data fetch
 * (`useTarkovGameData`), mounted once in the root layout (`app/layout.tsx`)
 * so every route benefits, not just the components that happen to read
 * task/item/map data directly. Silent by default - `useTarkovGameData`
 * already keeps serving the last successful fetch through a transient
 * outage (`use-tarkov-game-data.ts`'s merge-with-previous safety net), so
 * most visitors never see this at all; it only appears once a fetch has
 * actually failed (`isError`), via the shared `useGameDataBannerVisible`
 * (also consulted by `MapsPage.tsx` to reserve exactly this much extra
 * height above its full-bleed viewport).
 *
 * Two distinct messages, not one generic "something went wrong": whether
 * `data` is still populated (a previously-successful fetch, just now stale)
 * changes what's actually true for the visitor - "you're looking at
 * slightly old data" is a very different, less alarming situation than "no
 * data loaded at all", and conflating them would either needlessly panic
 * the common case or under-communicate the rare one.
 *
 * Fixed `h-9` height (not `min-h-9`/wrapping text) is load-bearing, not
 * cosmetic - `MapsPage.tsx`'s calc subtracts this exact value, so a taller
 * (wrapped) banner would leave a gap or clip the map viewport by the
 * overflow amount. `truncate` on the message keeps that true at any
 * viewport width instead of only at the widths this was eyeballed at.
 */
export function GameDataStatusBanner() {
  const { data } = useTarkovGameData();
  const visible = useGameDataBannerVisible();
  const dismiss = useGameDataBannerStore((state) => state.dismiss);

  if (!visible) return null;

  const hasCachedData = data !== undefined;

  return (
    <div
      role="status"
      className={cn(
        "flex h-9 shrink-0 items-center justify-center gap-2 px-3 text-xs sm:text-sm",
        hasCachedData
          ? "bg-status-amber-soft text-status-amber"
          : "bg-status-red-soft text-status-red",
      )}
    >
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">
        {hasCachedData
          ? "tarkov.dev is unreachable — showing cached data, which may be out of date."
          : "tarkov.dev is unreachable — task, item, and map data can't load right now."}
      </span>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="shrink-0 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
