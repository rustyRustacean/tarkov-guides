"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Crown, Navigation, Users } from "lucide-react";
import { useState } from "react";

import { copyToClipboard } from "@/shared/lib/clipboard";
import { Button } from "@/shared/ui/button/Button";
import { toast } from "@/shared/ui/toast/toast-store";

import type { SessionParticipant } from "../../session/use-maps-session";

export interface SessionStatusPillProps {
  code: string;
  isHost: boolean;
  isController: boolean;
  participants: readonly SessionParticipant[];
  onRequestControl: () => void;
  onReleaseControl: () => void;
  onLeave: () => void;
  onEnd: () => void;
}

/**
 * Shown in place of the "Collaborate" button once a session is active - a
 * compact colored-dot participant row plus a dropdown for invite/control/
 * leave/end, rather than a permanently-expanded panel, so it doesn't compete
 * for space with `MapVariantSwitcher`/the fullscreen button in the same
 * floating-chrome cluster (`MapScreenLayout.tsx`).
 */
export function SessionStatusPill({
  code,
  isHost,
  isController,
  participants,
  onRequestControl,
  onReleaseControl,
  onLeave,
  onEnd,
}: SessionStatusPillProps) {
  const [open, setOpen] = useState(false);

  async function handleCopy(label: string, text: string): Promise<void> {
    const ok = await copyToClipboard(text);
    toast({ message: ok ? `${label} copied!` : `Couldn't copy ${label.toLowerCase()}.` });
  }

  return (
    // `modal={false}` - see `ThemePicker.tsx` for why: Radix's default
    // scroll lock sets `overflow: hidden` on `<body>`, which breaks the
    // site header's `position: sticky` by making body its scroll
    // container instead of the viewport.
    <DropdownMenu.Root open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <Users className="h-4 w-4" aria-hidden="true" />
          <span className="flex items-center -space-x-1">
            {participants.map((participant) => (
              <span
                key={participant.id}
                className="border-background inline-block h-3.5 w-3.5 rounded-full border"
                style={{ backgroundColor: participant.color }}
                title={participant.name}
              />
            ))}
          </span>
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="border-border bg-popover text-popover-foreground z-50 w-64 rounded-md border p-1 shadow-lg"
        >
          <div className="px-2 py-1.5">
            <p className="text-xs font-medium">Session: {code}</p>
          </div>

          <DropdownMenu.Separator className="bg-border my-1 h-px" />

          {participants.map((participant) => (
            <div key={participant.id} className="flex items-center gap-2 px-2 py-1 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: participant.color }}
              />
              <span className="flex-1 truncate">{participant.name}</span>
              {participant.isHost && (
                <Crown className="text-muted-foreground h-3.5 w-3.5" aria-label="Host" />
              )}
            </div>
          ))}

          <DropdownMenu.Separator className="bg-border my-1 h-px" />

          <DropdownMenu.Item
            onSelect={() => void handleCopy("Code", code)}
            className="hover:bg-accent data-[highlighted]:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none"
          >
            Copy code
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => void handleCopy("Invite link", inviteLinkFor(code))}
            className="hover:bg-accent data-[highlighted]:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none"
          >
            Copy invite link
          </DropdownMenu.Item>

          {!isController && (
            <DropdownMenu.Item
              onSelect={onRequestControl}
              className="hover:bg-accent data-[highlighted]:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none"
            >
              <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
              Request control
            </DropdownMenu.Item>
          )}
          {isController && !isHost && (
            <DropdownMenu.Item
              onSelect={onReleaseControl}
              className="hover:bg-accent data-[highlighted]:bg-accent flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none"
            >
              Release control
            </DropdownMenu.Item>
          )}

          <DropdownMenu.Separator className="bg-border my-1 h-px" />

          <DropdownMenu.Item
            onSelect={isHost ? onEnd : onLeave}
            className="hover:bg-accent data-[highlighted]:bg-accent text-destructive flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none"
          >
            {isHost ? "End session" : "Leave session"}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function inviteLinkFor(code: string): string {
  if (typeof window === "undefined") return code;
  const url = new URL(window.location.href);
  url.searchParams.set("session", code);
  return url.toString();
}
