"use client";

import { useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";
import { FactionToggle } from "@/shared/ui/faction-toggle/FactionToggle";
import { SegmentedControl } from "@/shared/ui/segmented-control/SegmentedControl";

import { useProgressTrackerStore } from "../store";
import { existingModesForProfile, PROFILE_MODE_LABELS, PROFILE_MODES } from "../types";

import type { Profile, ProfileFaction, ProfileMode } from "../types";
import type { SubmitEvent } from "react";

export interface ProfileManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MODE_OPTIONS: readonly { value: ProfileMode; label: string }[] = PROFILE_MODES.map(
  (mode) => ({ value: mode, label: PROFILE_MODE_LABELS[mode] }),
);

/**
 * Create/edit/delete profiles, and see each one's mode-characters at a
 * glance. A profile can hold up to 3 independent mode-characters (PvP/PvE/
 * Season, see `ModeSwitcher.tsx` for how a mode actually gets added). This
 * dialog only handles the identity itself (name) plus the very first
 * mode-character, seeded at creation time.
 *
 * Editing a profile only ever touches its name: mode is no longer "the"
 * mode of a profile (it can have several at once), and faction is
 * immutable once a mode-bucket exists (enforced at the type level:
 * `Profile` carries neither field at all anymore, see `types.ts`),
 * matching legacy's own reasoning: changing faction after the fact would
 * invalidate faction-scoped task/hideout progress.
 *
 * Delete uses an inline two-step confirm (click Delete → Confirm/Cancel
 * buttons replace it) rather than `window.confirm()`, consistent with this
 * project's "no native confirm dialogs" convention (see the Wipe flow),
 * without needing a new `AlertDialog` primitive just for this one use,
 * since the confirmation already happens inside this Dialog's own
 * focus-trapped, keyboard-accessible surface.
 */
export function ProfileManagerDialog({ open, onOpenChange }: ProfileManagerDialogProps) {
  const profiles = useProgressTrackerStore((state) => state.profiles);
  const progressByProfile = useProgressTrackerStore((state) => state.progressByProfile);
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
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>): void {
    event.preventDefault();
    const trimmedName = formName.trim();
    if (trimmedName.length === 0) return;

    if (editingId !== null) {
      updateProfile(editingId, { name: trimmedName });
      resetForm();
    } else {
      createProfile({ name: trimmedName, mode: formMode, faction: formFaction, face: null });
      resetForm();
      // Creating a profile closes the manager: the new profile is now active
      // and selectable from the switcher, so there's nothing left to do here.
      onOpenChange(false);
    }
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
            Each profile can track PvP, PvE, and Season progress independently - use the mode
            switcher in the header to set up additional modes for a profile.
          </DialogDescription>
        </DialogHeader>

        <ul className="mt-4 -mr-2 flex max-h-[40vh] flex-col gap-2 overflow-y-auto pr-2">
          {profiles.length === 0 && (
            <li className="text-muted-foreground text-sm">No profiles yet - create one below.</li>
          )}
          {profiles.map((profile) => {
            const modes = existingModesForProfile(progressByProfile, profile.id);
            return (
              <li
                key={profile.id}
                className="border-border flex items-center justify-between gap-3 rounded-md border p-2 text-sm"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{profile.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {[...modes.entries()]
                      .map(([mode, faction]) => `${PROFILE_MODE_LABELS[mode]} (${faction})`)
                      .join(" · ")}
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
            );
          })}
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

          {editingId === null && (
            <>
              <div className="flex flex-col gap-1.5 text-sm">
                <span id="new-profile-mode-label">Starting mode</span>
                <SegmentedControl
                  options={MODE_OPTIONS}
                  value={formMode}
                  onChange={setFormMode}
                  aria-labelledby="new-profile-mode-label"
                />
              </div>

              <div className="flex flex-col gap-1.5 text-sm">
                <span id="new-profile-faction-label">Faction (cannot be changed later)</span>
                <FactionToggle
                  value={formFaction}
                  onChange={setFormFaction}
                  aria-labelledby="new-profile-faction-label"
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="submit" size="sm">
              {editingId !== null ? "Save Changes" : "Create Profile"}
            </Button>
            {editingId !== null && (
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
