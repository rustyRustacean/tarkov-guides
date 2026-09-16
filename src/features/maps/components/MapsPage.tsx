"use client";

import { Suspense } from "react";

import { useGameDataBannerVisible } from "@/shared/lib/tarkov-api/use-game-data-banner-visible";
import { Card } from "@/shared/ui/card/Card";
import { cn } from "@/shared/ui/lib/cn";
import { useSiteStatusBannerVisible } from "@/shared/ui/site-status-banner/use-site-status-banner-visible";

import { useCompanionMapFollow } from "../hooks/use-companion-map-follow";
import { useMapsHydrateOnMount } from "../hooks/use-hydrate-on-mount";
import { useMapsPersistenceSync } from "../hooks/use-persistence-sync";
import { MapSessionRoomProvider } from "../session/liveblocks-config";
import { useMapsStore } from "../store";

import { MapBossStrips } from "./MapBossStrips";
import { MapPicker } from "./MapPicker";
import { MapPickerRaidTime } from "./MapPickerRaidTime";
import { MapScreenLayout } from "./MapScreenLayout";
import { MapUrlParamHandler } from "./MapUrlParamHandler";
import { TarkovClock } from "./TarkovClock";

/**
 * Top-level shell for the Maps feature. Wires up the once-on-mount
 * localStorage hydration and the ongoing debounced persistence sync
 * (mirrors `ProgressTrackerPage`'s exact pattern), then renders the map
 * picker plus the fully-composed `MapScreenLayout` for whichever map is
 * currently selected (`useMapsStore`'s `currentMap`).
 *
 * Unlike Progress Tracker's page (a normal scrolling `max-w-5xl` content
 * column), this is a full-bleed viewport feature: `MapScreenLayout`'s
 * internal DOM assumes a real bounded height via `h-full` cascading
 * throughout its sidebar/viewer/valuables columns. The root layout's
 * `<main className="flex-1">` has no explicit height of its own (it only
 * grows to fill whatever `<body>` leaves over), so this page gives itself
 * an explicit height instead of depending on that cascade:
 * `calc(100vh-3.5rem)` matches the header's real height (`h-14`), further
 * reduced by another `2.25rem` per visible banner stacked between the header
 * and this page. `GameDataStatusBanner` and `SiteStatusBanner` are both a
 * fixed `h-9`, and either, both, or neither can be on screen at once
 * (`useGameDataBannerVisible()` / `useSiteStatusBannerVisible()`), so the
 * three possible totals (0, 1, or 2 banners showing) are precomputed as
 * their own literal Tailwind arbitrary-value classes below rather than a
 * single interpolated calc string, since Tailwind's JIT scanner only picks
 * up class names that appear literally in source. These are
 * guessed/hardcoded, not measured, so they only stay correct as long as
 * they're kept in sync with those components' real heights. Full width, not
 * `max-w-*`-constrained, so the 3-column map layout gets the full viewport.
 * `ConditionalFooter` (root layout) skips rendering `Footer` on this route
 * so it doesn't add dead scroll space below a screen meant to fill the
 * viewport exactly. Also mounts `MapUrlParamHandler`, which applies a
 * `?map=` deep link from another feature (e.g. Progress Tracker's map
 * recommendation dialog); see its own doc comment and `useMapUrlParam`; and
 * `useCompanionMapFollow`, which (behind its own opt-in preference) switches
 * `currentMap` to follow the game's active raid and screenshot positions.
 */
export function MapsPage() {
  useMapsHydrateOnMount();
  useMapsPersistenceSync();
  useCompanionMapFollow();

  const currentMap = useMapsStore((state) => state.currentMap);
  const visibleBannerCount =
    (useGameDataBannerVisible() ? 1 : 0) + (useSiteStatusBannerVisible() ? 1 : 0);

  return (
    // Wraps both `MapPicker` and `MapScreenLayout`: a collaborative
    // session's control-handoff gates map/variant switching in both places
    // (`MapPicker`'s map tabs, `MapVariantSwitcher`'s variant tabs), so both
    // need to be inside the same always-mounted room provider (see its own
    // doc comment for why it's unconditional rather than session-gated).
    <MapSessionRoomProvider>
      {/* Applies a `?map=` deep link (see `MapUrlParamHandler`/
          `useMapUrlParam`); own `Suspense` boundary since it calls
          `useSearchParams`, same shape as `MapScreenLayout`'s boundary
          around `SessionControls`. Renders nothing. */}
      <Suspense fallback={null}>
        <MapUrlParamHandler />
      </Suspense>
      <div
        className={cn(
          "flex w-full flex-col",
          visibleBannerCount === 2
            ? "h-[calc(100vh-8rem)]"
            : visibleBannerCount === 1
              ? "h-[calc(100vh-3.5rem-2.25rem)]"
              : "h-[calc(100vh-3.5rem)]",
        )}
      >
        <div className="border-border border-b">
          {/* Map tabs get their own row, always: this used to be a single
              flex-wrap row shared with the boss/clock/raid group below,
              which let that group ride up beside the tabs whenever there
              was room. Two fixed rows instead, so the intel group's
              position never depends on how many map tabs currently fit. */}
          <div className="flex flex-wrap items-center gap-3 p-3 pb-2.5">
            <MapPicker />
          </div>
          {/* Inset (not edge-to-edge like the section's own `border-b`
              above/below) and a touch lighter, so it reads as a secondary
              seam between "which map" and "what's on it" rather than
              repeating the heavier outer border. */}
          <div className="border-border/60 mx-4 border-t" />
          <div className="flex min-w-0 flex-wrap items-center gap-5 p-3 pt-2.5">
            {/* `pl-7` (icon `size-5` + its `gap-2`, matching `MapPicker`'s
                own layout) lines the boss roster's left edge up with the
                map tabs' left edge above, not the map icon further left;
                `sm:` since the icon itself is hidden below that
                breakpoint. */}
            <div className="pl-0 sm:pl-7">
              <MapBossStrips normalizedName={currentMap} />
            </div>
            {/* Clock and Raid share one card as a single "reference"
                cluster (distinct from the boss roster's own "what do I
                need to react to" one), `divide-x` rather than a divider
                either component owns itself, so it only ever appears
                between two things that are both actually rendered (some
                maps have no raid-time data at all). */}
            <Card className="border-l-status-amber/50 divide-border/60 ml-auto flex items-center gap-3 divide-x border-l-2 px-3 py-2">
              <TarkovClock />
              <MapPickerRaidTime normalizedName={currentMap} />
            </Card>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <MapScreenLayout normalizedName={currentMap} />
        </div>
      </div>
    </MapSessionRoomProvider>
  );
}
