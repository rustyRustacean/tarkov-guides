"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";
import { FactionToggle } from "@/shared/ui/faction-toggle/FactionToggle";

import { useProgressTrackerStore } from "../store";
import { PROFILE_MODE_LABELS } from "../types";

import type { ProfileFaction, ProfileMode } from "../types";
import type { SubmitEvent } from "react";

export interface SetUpModeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  profileName: string;
  mode: ProfileMode;
}

/**
 * Faction picker for setting up a new mode-character on an existing
 * profile. Shared by `NoActiveProfileNotice` and `ModeSwitcher`, the two
 * places a user can discover "this profile doesn't have a {mode} character
 * yet." Faction is immutable once the bucket is created (same convention as
 * profile creation; see `ProfileManagerDialog`), so this is the only place
 * it's ever chosen for a given mode.
 */
export function SetUpModeDialog({
  open,
  onOpenChange,
  profileId,
  profileName,
  mode,
}: SetUpModeDialogProps) {
  const createProfileMode = useProgressTrackerStore((state) => state.createProfileMode);
  const switchMode = useProgressTrackerStore((state) => state.switchMode);
  const [faction, setFaction] = useState<ProfileFaction>("BEAR");

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    createProfileMode({ profileId, mode, faction });
    switchMode(mode);
    onOpenChange(false);
  }

  const modeLabel = PROFILE_MODE_LABELS[mode];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Set up {modeLabel} for {profileName}
          </DialogTitle>
          <DialogDescription>
            Choose a faction for this mode-character - it can&apos;t be changed later.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 text-sm">
            <span id="set-up-mode-faction-label">Faction</span>
            <FactionToggle
              value={faction}
              onChange={setFaction}
              aria-labelledby="set-up-mode-faction-label"
            />
          </div>

          <div className="mt-1 flex gap-2">
            <Button type="submit" size="sm">
              Set up {modeLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
