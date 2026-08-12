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

const FACTIONS: readonly ProfileFaction[] = ["BEAR", "USEC"];

/**
 * Faction picker for setting up a new mode-character on an already-existing
 * profile - shared by `NoActiveProfileNotice` and `ModeSwitcher`, the two
 * places a user can discover "this profile doesn't have a {mode} character
 * yet." Faction is immutable once the bucket is created (same convention as
 * profile creation, see `ProfileManagerDialog`), so this is the one and
 * only place it's ever chosen for a given mode.
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
          <fieldset className="flex flex-col gap-1 text-sm">
            <legend className="mb-1">Faction</legend>
            <div className="flex gap-4">
              {FACTIONS.map((option) => (
                <label key={option} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="faction"
                    value={option}
                    checked={faction === option}
                    onChange={() => {
                      setFaction(option);
                    }}
                  />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>

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
