"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button/Button";

import { ProfileManagerDialog } from "./ProfileManagerDialog";

export interface NoActiveProfileNoticeProps {
  /** Completes "No active profile - create one to {reason}." e.g. "view the quest tree". */
  reason: string;
}

/**
 * Shared "no active profile yet" empty state for every Progress Tracker
 * surface gated on `activeProfileId`/`progress` - previously each of the 9
 * call sites below showed this exact sentence as plain text with no way to
 * actually create one, leaving a first-time visitor to separately discover
 * the header's profile switcher on their own (confirmed source of real user
 * confusion, 2026-08-05). The button opens the same {@link ProfileManagerDialog}
 * create flow as `ProfileSwitcher`'s "Manage Profiles" item - nesting fine
 * inside a caller that's already showing its own `Dialog` (`CharacterStatsDialog`,
 * `MapRecommendationDialog`), since Radix stacks dialogs correctly.
 */
export function NoActiveProfileNotice({ reason }: NoActiveProfileNoticeProps) {
  const [managerOpen, setManagerOpen] = useState(false);

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
