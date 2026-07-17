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

import type { Profile, ProfileFaction, ProfileMode } from "../types";
import type { SubmitEvent } from "react";

export interface ProfileManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODES: readonly ProfileMode[] = ["PVP", "PVE"];
const FACTIONS: readonly ProfileFaction[] = ["BEAR", "USEC"];

/**
 * Create/edit/delete profiles. Faction is only offered while creating -
 * editing a profile omits the faction control entirely (the type-level
 * enforcement lives in `ProfileUpdate`, see `types.ts`), matching legacy's
 * own reasoning: changing faction after the fact would invalidate
 * faction-scoped task/hideout progress.
 *
 * Delete uses an inline two-step confirm (click Delete → Confirm/Cancel
 * buttons replace it) rather than `window.confirm()` - consistent with
 * this project's "no native confirm dialogs" convention (see the Wipe
 * flow) - without needing a new `AlertDialog` primitive just for this one
 * use, since the confirmation already happens inside this Dialog's own
 * focus-trapped, keyboard-accessible surface.
 */
export function ProfileManagerDialog({ open, onOpenChange }: ProfileManagerDialogProps) {
  const profiles = useProgressTrackerStore((state) => state.profiles);
  const createProfile = useProgressTrackerStore((state) => state.createProfile);
  const updateProfile = useProgressTrackerStore((state) => state.updateProfile);
  const deleteProfile = useProgressTrackerStore((state) => state.deleteProfile);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formMode, setFormMode] = useState<ProfileMode>("PVP");
  const [formFaction, setFormFaction] = useState<ProfileFaction>("BEAR");

  function resetForm(): void {
    setEditingId(null);
    setFormName("");
    setFormMode("PVP");
    setFormFaction("BEAR");
  }

  function startEditing(profile: Profile): void {
    setConfirmingDeleteId(null);
    setEditingId(profile.id);
    setFormName(profile.name);
    setFormMode(profile.mode);
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmedName = formName.trim();
    if (trimmedName.length === 0) return;

    if (editingId !== null) {
      updateProfile(editingId, { name: trimmedName, mode: formMode });
    } else {
      createProfile({ name: trimmedName, mode: formMode, faction: formFaction, face: null });
    }
    resetForm();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          resetForm();
          setConfirmingDeleteId(null);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Profiles</DialogTitle>
          <DialogDescription>
            Each profile tracks its own quest, stash, hideout, and Kappa progress.
          </DialogDescription>
        </DialogHeader>

        <ul className="mt-4 flex flex-col gap-2">
          {profiles.length === 0 && (
            <li className="text-muted-foreground text-sm">No profiles yet - create one below.</li>
          )}
          {profiles.map((profile) => (
            <li
              key={profile.id}
              className="border-border flex items-center justify-between gap-3 rounded-md border p-2 text-sm"
            >
              <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{profile.name}</span>
                <span className="text-muted-foreground text-xs">
                  {profile.faction} · {profile.mode}
                </span>
              </div>

              {confirmingDeleteId === profile.id ? (
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      deleteProfile(profile.id);
                      setConfirmingDeleteId(null);
                      if (editingId === profile.id) resetForm();
                    }}
                  >
                    Confirm
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setConfirmingDeleteId(null);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex shrink-0 gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      startEditing(profile);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setConfirmingDeleteId(profile.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>

        <form
          onSubmit={handleSubmit}
          className="border-border mt-4 flex flex-col gap-3 border-t pt-4"
        >
          <h3 className="text-sm font-medium">
            {editingId !== null ? "Edit Profile" : "New Profile"}
          </h3>

          <label className="flex flex-col gap-1 text-sm">
            Name
            <input
              type="text"
              value={formName}
              onChange={(event) => {
                setFormName(event.target.value);
              }}
              maxLength={40}
              required
              className="border-border bg-background focus-visible:ring-ring rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none"
            />
          </label>

          <fieldset className="flex flex-col gap-1 text-sm">
            <legend className="mb-1">Mode</legend>
            <div className="flex gap-4">
              {MODES.map((mode) => (
                <label key={mode} className="flex items-center gap-1.5">
                  <input
                    type="radio"
                    name="mode"
                    value={mode}
                    checked={formMode === mode}
                    onChange={() => {
                      setFormMode(mode);
                    }}
                  />
                  {mode}
                </label>
              ))}
            </div>
          </fieldset>

          {editingId === null && (
            <fieldset className="flex flex-col gap-1 text-sm">
              <legend className="mb-1">Faction (cannot be changed later)</legend>
              <div className="flex gap-4">
                {FACTIONS.map((faction) => (
                  <label key={faction} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="faction"
                      value={faction}
                      checked={formFaction === faction}
                      onChange={() => {
                        setFormFaction(faction);
                      }}
                    />
                    {faction}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-1 flex gap-2">
            <Button type="submit" size="sm">
              {editingId !== null ? "Save Changes" : "Create Profile"}
            </Button>
            {editingId !== null && (
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
