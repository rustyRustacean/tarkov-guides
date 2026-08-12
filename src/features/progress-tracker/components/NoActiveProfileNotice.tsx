"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button/Button";

import { useProgressTrackerStore } from "../store";
import { PROFILE_MODE_LABELS } from "../types";

import { ProfileManagerDialog } from "./ProfileManagerDialog";
import { SetUpModeDialog } from "./SetUpModeDialog";

export interface NoActiveProfileNoticeProps {
  /** Completes "…create one to {reason}." / "…set one up to {reason}." e.g. "view the quest tree". */
  reason: string;
}

/**
 * Shared empty state for every Progress Tracker surface gated on
 * `activeProfileId`/`useActiveProgress()` returning nothing - previously
 * each of the 9 call sites below showed a plain "No active profile" sentence
 * with no way to actually create one, leaving a first-time visitor to
 * separately discover the header's profile switcher on their own (confirmed
 * source of real user confusion, 2026-08-05).
 *
 * Reads the store itself (rather than taking a `kind` prop) to distinguish
 * the two distinct reasons this can be empty since the 2026-08 game-mode
 * rework - no active profile at all, vs. an active profile that just
 * hasn't set up the currently-active mode yet - so every existing call
 * site's `if (!progress) return <NoActiveProfileNotice reason="..."/>`
 * guard keeps working unmodified in both cases. The button opens
 * {@link ProfileManagerDialog}'s create flow (case 1) or
 * {@link SetUpModeDialog}'s faction picker (case 2) - nesting fine inside a
 * caller that's already showing its own `Dialog` (`CharacterStatsDialog`,
 * `MapRecommendationDialog`), since Radix stacks dialogs correctly.
 */
export function NoActiveProfileNotice({ reason }: NoActiveProfileNoticeProps) {
  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const activeMode = useProgressTrackerStore((state) => state.activeMode);
  const activeProfileName = useProgressTrackerStore(
    (state) => state.profiles.find((profile) => profile.id === state.activeProfileId)?.name,
  );
  const [managerOpen, setManagerOpen] = useState(false);
  const [setUpModeOpen, setSetUpModeOpen] = useState(false);

  if (activeProfileId !== null && activeProfileName !== undefined) {
    const modeLabel = PROFILE_MODE_LABELS[activeMode];
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-muted-foreground text-sm">
          No {modeLabel} character yet for {activeProfileName} - set one up to {reason}.
        </p>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setSetUpModeOpen(true);
          }}
        >
          Set up {modeLabel}
        </Button>
        <SetUpModeDialog
          open={setUpModeOpen}
          onOpenChange={setSetUpModeOpen}
          profileId={activeProfileId}
          profileName={activeProfileName}
          mode={activeMode}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-muted-foreground text-sm">No active profile - create one to {reason}.</p>
      <Button
        type="button"
        size="sm"
        onClick={() => {
          setManagerOpen(true);
        }}
      >
        Create Profile
      </Button>
      <ProfileManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
    </div>
  );
}
