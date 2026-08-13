"use client";

import { useRef } from "react";

import { cn } from "../lib/cn";

import type { KeyboardEvent } from "react";

export type Faction = "BEAR" | "USEC";

const FACTIONS: readonly Faction[] = ["BEAR", "USEC"];

/** The selected faction's panel gets this share of the track width, the other gets the remainder. */
const ACTIVE_PERCENT = 70;

/**
 * Emblem URLs are hotlinked from the EFT fandom wiki's own image CDN
 * (`BEAR`/`USEC` articles' infobox emblems, both served from
 * `static.wikia.nocookie.net` with open CORS and a far-future cache
 * header), the same live-hotlink convention `shared/lib/wiki/fetch-wiki.ts`
 * already established for quest screenshots: never downloaded and
 * re-hosted. `next.config.ts`'s CSP `img-src` already allowlists this host
 * for that reason.
 *
 * `referrerPolicy="no-referrer"` on the `<img>` below is required, not
 * cosmetic: confirmed live that this CDN 404s hotlink requests carrying a
 * third-party `Referer` (any non-`fandom.com` origin, including
 * `localhost`) but serves normally with none. The default browser
 * behavior of forwarding this site's own URL as `Referer` would otherwise
 * silently break every emblem.
 *
 * `label` doubles as the `<img alt>`: each emblem already has the faction
 * name lettered onto the artwork, so no separate on-screen text label is
 * rendered.
 */
const FACTION_META: Record<Faction, { label: string; emblem: string; panelBg: string }> = {
  BEAR: {
    label: "BEAR",
    emblem:
      "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/a/a1/BEAR_Icon.png/revision/latest/scale-to-width-down/320?cb=20231024012423",
    panelBg: "linear-gradient(135deg, #7a231f 0%, #33100d 100%)",
  },
  USEC: {
    label: "USEC",
    emblem:
      "https://static.wikia.nocookie.net/escapefromtarkov_gamepedia/images/b/bf/USEC_Emblem.png/revision/latest/scale-to-width-down/320?cb=20231024014129",
    panelBg: "linear-gradient(135deg, #234a82 0%, #0d1d3d 100%)",
  },
};

export interface FactionToggleProps {
  value: Faction;
  onChange: (faction: Faction) => void;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

/**
 * Animated BEAR/USEC split-reveal toggle: two panels sharing one track,
 * the selected faction's panel widened to {@link ACTIVE_PERCENT}% (the
 * other compressed to the remainder) with a glowing divider line sliding
 * between the two states on click (or arrow key). Each panel's emblem is
 * deliberately sized wider than its compressed share of the track and
 * anchored to the track's outer edge (`object-left` for BEAR, `object-right`
 * for USEC) so the panel's own `overflow-hidden` crops it there. The
 * compressed side shows only a sliver of its emblem, and selecting it
 * slides the divider away to reveal the whole thing.
 *
 * Interaction details:
 * - The *inactive* panel's emblem is rendered dim, desaturated, and
 *   slightly blurred (unmistakably "not selected" at a glance); hovering
 *   that panel clears all three back to normal as a quick "peek", purely
 *   via `group-hover`. It does not touch the split or move the divider,
 *   so hovering never previews a layout change, only the emblem's own
 *   clarity.
 * - `active:` press feedback (scale + brightness) gives immediate tactile
 *   confirmation on click/tap, ahead of the slower settle transition.
 * - Every transition/animation here is cosmetic, not load-bearing (the
 *   underlying state change is instant), so `motion-reduce:` disables all
 *   of it for users with `prefers-reduced-motion` set.
 *
 * Accessibility: hand-rolled WAI-ARIA `radiogroup` (roving tabindex,
 * arrow-key switching) rather than pulling in `@radix-ui/react-toggle-group`
 * for what's only ever a 2-option control, matching this project's
 * existing hand-rolled-over-Radix convention for simple cases (see
 * `Checkbox.tsx`). The focus ring is drawn `ring-inset`: each panel is
 * `overflow-hidden` (needed for the emblem-crop effect above), and a
 * regular outer box-shadow ring gets silently clipped to a near-invisible
 * sliver by that same `overflow-hidden` (confirmed live via a focused
 * screenshot before switching to `ring-inset`, which draws inside the box
 * and so isn't clipped).
 *
 * Purely a controlled `value`/`onChange` pair, not a native form control:
 * both call sites (`ProfileManagerDialog`, `SetUpModeDialog`) already drive
 * faction choice through component state rather than `FormData`.
 */
export function FactionToggle({
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: FactionToggleProps) {
  const buttonRefs = useRef<Partial<Record<Faction, HTMLButtonElement | null>>>({});
  const bearPercent = value === "BEAR" ? ACTIVE_PERCENT : 100 - ACTIVE_PERCENT;

  // Roving-tabindex arrow key handling lives on the buttons themselves
  // (already focusable), not the `radiogroup` div: the div is never a tab
  // stop, matching the WAI-ARIA radiogroup pattern where only the checked
  // radio is in the tab order.
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next: Faction = value === "BEAR" ? "USEC" : "BEAR";
    onChange(next);
    buttonRefs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? "Faction")}
      aria-labelledby={ariaLabelledBy}
      className={cn(
        "border-border relative flex h-36 w-full overflow-hidden rounded-xl border",
        className,
      )}
    >
      {FACTIONS.map((faction) => {
        const meta = FACTION_META[faction];
        const active = faction === value;
        const isBear = faction === "BEAR";
        const panelPercent = isBear ? bearPercent : 100 - bearPercent;
        return (
          <button
            key={faction}
            ref={(el) => {
              buttonRefs.current[faction] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => {
              onChange(faction);
            }}
            onKeyDown={handleKeyDown}
            style={{
              width: `${String(panelPercent)}%`,
              background: meta.panelBg,
              transition: "width 500ms cubic-bezier(0.65,0,0.35,1), transform 150ms ease-out",
            }}
            className="group relative h-full overflow-hidden outline-none ring-inset focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-white active:scale-[0.98] active:brightness-125 motion-reduce:transition-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- external fandom-wiki-hosted emblem, not a local/optimizable asset. */}
            <img
              src={meta.emblem}
              alt={meta.label}
              referrerPolicy="no-referrer"
              loading="lazy"
              decoding="async"
              className={cn(
                "absolute top-1/2 h-28 w-44 -translate-y-1/2 object-contain drop-shadow-lg transition-[opacity,filter] duration-300 motion-reduce:transition-none",
                isBear ? "left-3 object-left" : "right-3 object-right",
                active
                  ? "opacity-100"
                  : "opacity-40 blur-[2px] grayscale group-hover:opacity-90 group-hover:blur-none group-hover:grayscale-0",
              )}
              onError={(event) => {
                event.currentTarget.style.visibility = "hidden";
              }}
            />
          </button>
        );
      })}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 bottom-0 z-10 w-px -translate-x-1/2 bg-white/80 shadow-[0_0_10px_2px_rgba(255,255,255,0.55)] transition-[left] duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none"
        style={{ left: `${String(bearPercent)}%` }}
      />
    </div>
  );
}
