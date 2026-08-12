"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown, Settings2, UserRound } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button/Button";

import { useProgressTrackerStore } from "../store";
import { existingModesForProfile, PROFILE_MODE_LABELS } from "../types";

import { ProfileManagerDialog } from "./ProfileManagerDialog";

/**
 * Active-profile display + switcher, built on the same Radix
 * `DropdownMenuRadioGroup` pattern as `src/shared/ui/theme/ThemePicker.tsx`.
 * A "Manage Profiles" item at the bottom opens {@link ProfileManagerDialog}
 * for create/edit/delete.
 */
export function ProfileSwitcher() {
  const profiles = useProgressTrackerStore((state) => state.profiles);
  const progressByProfile = useProgressTrackerStore((state) => state.progressByProfile);
  const activeProfileId = useProgressTrackerStore((state) => state.activeProfileId);
  const switchProfile = useProgressTrackerStore((state) => state.switchProfile);
  const [managerOpen, setManagerOpen] = useState(false);

  const activeProfile = profiles.find((profile) => profile.id === activeProfileId);

  return (
    <>
      {/* `modal={false}` - see `ThemePicker.tsx` for why: Radix's default
          scroll lock sets `overflow: hidden` on `<body>`, which breaks the
          site header's `position: sticky` by making body its scroll
          container instead of the viewport. */}
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            variant="outline"
            size="md"
            className="gap-2"
            aria-label={`Active profile: ${activeProfile?.name ?? "No Profile"}`}
          >
            <UserRound className="h-4 w-4" aria-hidden="true" />
            {/* Hidden below `sm` - icon+chevron only, so this doesn't get
                pushed off-screen alongside `ModeSwitcher` in the header's
                fixed-width right-hand control cluster on narrow viewports.
                The button's own `aria-label` above (not this text) is the
                accessible name at every width, so hiding this never leaves
                the trigger unlabeled for a screen reader on mobile. */}
            <span aria-hidden="true" className="hidden max-w-32 truncate sm:inline">
              {activeProfile?.name ?? "No Profile"}
            </span>
            <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={8}
            className="border-border bg-popover text-popover-foreground z-50 w-56 rounded-md border p-1 shadow-lg"
          >
            {profiles.length === 0 && (
              <div className="text-muted-foreground px-2 py-1.5 text-sm">No profiles yet</div>
            )}

            {profiles.length > 0 && (
              <DropdownMenu.RadioGroup
                // `exactOptionalPropertyTypes` + Radix's strict `value: string`
                // (no `| undefined`) means `activeProfileId` (nullable) can't
                // always be spread in directly - conditionally include the
                // prop only when there's a real active id, leaving the group
                // uncontrolled (no checked item) otherwise.
                {...(activeProfileId !== null ? { value: activeProfileId } : {})}
                onValueChange={(value) => {
                  switchProfile(value);
                }}
              >
                {profiles.map((profile) => {
                  const modes = existingModesForProfile(progressByProfile, profile.id);
                  const modeSummary = [...modes.keys()]
                    .map((mode) => PROFILE_MODE_LABELS[mode])
                    .join(" · ");
                  return (
                    <DropdownMenu.RadioItem
                      key={profile.id}
                      value={profile.id}
                      className="hover:bg-accent data-[state=checked]:bg-accent data-[highlighted]:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none"
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        <DropdownMenu.ItemIndicator>
                          <Check className="h-4 w-4" aria-hidden="true" />
                        </DropdownMenu.ItemIndicator>
                      </span>
                      <span className="flex-1 truncate">{profile.name}</span>
                      <span className="text-muted-foreground text-xs">{modeSummary}</span>
                    </DropdownMenu.RadioItem>
                  );
                })}
              </DropdownMenu.RadioGroup>
            )}

            <DropdownMenu.Separator className="bg-border my-1 h-px" />

            <DropdownMenu.Item
              onSelect={() => {
                setManagerOpen(true);
              }}
              className="hover:bg-accent data-[highlighted]:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Manage Profiles
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ProfileManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
    </>
  );
}
