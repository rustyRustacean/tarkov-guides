"use client";

import { useState } from "react";

import { cn } from "@/shared/ui/lib/cn";

import { useProgressTrackerStore } from "../store";
import { existingModesForProfile, PROFILE_MODE_LABELS, PROFILE_MODES } from "../types";

import { SetUpModeDialog } from "./SetUpModeDialog";

import type { ProfileFaction, ProfileMode } from "../types";

const EMPTY_MODES: ReadonlyMap<ProfileMode, ProfileFaction> = new Map();

/** Shown below the `sm` breakpoint instead of `PROFILE_MODE_LABELS` - full labels are still the accessible name (`aria-label` below), this is purely a visual space-saver so the header's right-hand control cluster doesn't push `ProfileSwitcher` off-screen on a narrow viewport. */
const PROFILE_MODE_SHORT_LABELS: Readonly<Record<ProfileMode, string>> = {
  PVP: "PvP",
  PVE: "PvE",
  PVP_SEASONAL: "Szn",
};

/**
 * Always-visible PvP / PvE / Season pill switcher, in the spirit of
 * eftboss.com's mode switcher on its main page - deliberately NOT a Radix
 * `DropdownMenu` (already used twice in the header, for Theme and Profile):
 * mode is a fixed 3-value choice worth seeing and flipping at a glance, not
 * a list that benefits from being tucked away. `role="radiogroup"`/
 * `role="radio"` rather than Radix `Tabs` (which implies co-located content
 * panes) - this control's effect is felt across the whole page, not a
 * single component's pane switch.
 *
 * Clicking a mode the active profile hasn't set up yet opens
 * {@link SetUpModeDialog} (a faction picker) instead of switching straight
 * to it - `createProfileMode` requires an explicit faction choice, same as
 * profile creation. With no active profile at all, the pills freely change
 * `activeMode` anyway (a global preference independent of having a
 * profile) - matches `NoActiveProfileNotice`'s existing tolerance for
 * browsing before creating one.
 */
export function ModeSwitcher() {
  const activeMode = useProgressTrackerStore((state) => state.activeMode);
  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const activeProfileName = useProgressTrackerStore(
    (state) => state.profiles.find((profile) => profile.id === state.activeProfileId)?.name,
  );
  const progressByProfile = useProgressTrackerStore((state) => state.progressByProfile);
  const switchMode = useProgressTrackerStore((state) => state.switchMode);

  const [setUpMode, setSetUpMode] = useState<ProfileMode | null>(null);

  const existingModes =
    activeProfileId !== null
      ? existingModesForProfile(progressByProfile, activeProfileId)
      : EMPTY_MODES;

  function handleClick(mode: ProfileMode): void {
    if (activeProfileId === null || existingModes.has(mode)) {
      switchMode(mode);
      return;
    }
    setSetUpMode(mode);
  }

  return (
    <>
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
              handleClick(mode);
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

      {activeProfileId !== null && activeProfileName !== undefined && setUpMode !== null && (
        <SetUpModeDialog
          open
          onOpenChange={(open) => {
            if (!open) setSetUpMode(null);
          }}
          profileId={activeProfileId}
          profileName={activeProfileName}
          mode={setUpMode}
        />
      )}
    </>
  );
}
