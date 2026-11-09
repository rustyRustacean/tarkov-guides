"use client";

import { cn } from "@/shared/ui/lib/cn";

import { useProgressTrackerStore } from "../store";
import { PROFILE_MODE_LABELS, PROFILE_MODES } from "../types";

import type { ProfileMode } from "../types";

/** Shown below the `sm` breakpoint instead of `PROFILE_MODE_LABELS`: full labels are still the accessible name (`aria-label` below), this is purely a visual space-saver so the header's right-hand control cluster doesn't push `ProfileSwitcher` off-screen on a narrow viewport. */
const PROFILE_MODE_SHORT_LABELS: Readonly<Record<ProfileMode, string>> = {
  PVP: "PvP",
  PVE: "PvE",
  PVP_SEASONAL: "Szn",
};

/**
 * Always-visible PvP / PvE / Season pill switcher, in the spirit of
 * eftboss.com's mode switcher on its main page. This is the site's ONE game
 * mode control: every mode-dependent surface (tasks, flea prices, boss
 * spawns, extracts, raid times) reads the same `activeMode`, so there are no
 * per-feature mode toggles to keep in sync or to take up room. Deliberately
 * not a Radix `DropdownMenu` (already used twice in the header, for Theme and
 * Profile): mode is a fixed 3-value choice worth seeing and flipping at a
 * glance. `role="radiogroup"`/`role="radio"` rather than Radix `Tabs` (which
 * implies co-located content panes), since this control's effect is felt
 * across the whole page, not a single component's pane switch.
 *
 * A click always switches, even when the active profile has no character
 * for that mode yet: viewing PvE boss spawns or Seasonal prices shouldn't
 * require creating a character first. Progress Tracker surfaces then show
 * {@link NoActiveProfileNotice}'s "Set up {mode}" prompt in place, and the
 * store ignores progress writes for a mode with no character, so nothing is
 * fabricated.
 */
export function ModeSwitcher() {
  const activeMode = useProgressTrackerStore((state) => state.activeMode);
  const switchMode = useProgressTrackerStore((state) => state.switchMode);

  return (
    <div
      role="radiogroup"
      aria-label="Game mode"
      className="border-border bg-background flex items-center gap-0.5 rounded-md border p-0.5"
    >
      {PROFILE_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={mode === activeMode}
          aria-label={PROFILE_MODE_LABELS[mode]}
          onClick={() => {
            switchMode(mode);
          }}
          className={cn(
            "rounded-sm px-1.5 py-1 text-sm font-medium transition-colors sm:px-2.5",
            mode === activeMode
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
          )}
        >
          <span className="sm:hidden">{PROFILE_MODE_SHORT_LABELS[mode]}</span>
          <span className="hidden sm:inline">{PROFILE_MODE_LABELS[mode]}</span>
        </button>
      ))}
    </div>
  );
}
