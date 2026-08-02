"use client";

import { Radio } from "lucide-react";
import { useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";

import { COMPANION_DOWNLOAD_URL, type CompanionMode } from "./companion-config";
import { launchCompanion, useAutoLaunchPreference, useCompanionStatus } from "./use-companion";
import { useProfileSyncPreference } from "./use-companion-profile-sync";

const MODE_LABEL: Record<CompanionMode, string> = { pvp: "PvP", pve: "PvE" };

/**
 * Header control (sits to the left of the theme picker) that opens the EFT
 * Companion panel: live connection status when the local companion is running,
 * and download / auto-launch controls when it isn't. Polls localhost only
 * while the panel is open or auto-launch is enabled.
 */
export function CompanionButton() {
  const [open, setOpen] = useState(false);
  const [autoLaunch, setAutoLaunch] = useAutoLaunchPreference();
  const [profileSync, setProfileSync] = useProfileSyncPreference();
  const { status, isConnected, isChecking } = useCompanionStatus(open || autoLaunch || profileSync);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="EFT Companion"
        className="relative"
        onClick={() => {
          setOpen(true);
        }}
      >
        <Radio className="h-4 w-4" aria-hidden="true" />
        <span
          aria-hidden="true"
          className={`border-background absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 ${
            isConnected ? "bg-status-teal" : "bg-muted-foreground/40"
          }`}
        />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Radio className="h-4 w-4" aria-hidden="true" />
              EFT Companion
            </DialogTitle>
            <DialogDescription>
              Reads your Escape from Tarkov logs to sync your profile, game mode, and quests
              automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 flex flex-col gap-4">
            {isConnected && status ? (
              <div className="border-border bg-popover rounded-md border p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span className="bg-status-teal h-2 w-2 rounded-full" aria-hidden="true" />
                  Connected
                </div>
                <dl className="text-muted-foreground mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                  <dt>Mode</dt>
                  <dd className="text-foreground text-right">
                    {status.mode ? MODE_LABEL[status.mode] : "-"}
                    {status.faction ? ` · ${status.faction}` : ""}
                  </dd>
                  <dt>Quests</dt>
                  <dd className="text-foreground text-right">
                    {status.questsAvailable
                      ? `${String(status.questCounts.finished)} done / ${String(
                          status.questCounts.started,
                        )} active`
                      : "-"}
                  </dd>
                  {status.gameVersion ? (
                    <>
                      <dt>Game</dt>
                      <dd className="text-foreground text-right">v{status.gameVersion}</dd>
                    </>
                  ) : null}
                </dl>
              </div>
            ) : (
              <div className="border-border bg-popover rounded-md border p-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span
                    className="bg-muted-foreground/40 h-2 w-2 rounded-full"
                    aria-hidden="true"
                  />
                  {isChecking ? "Looking for the companion..." : "Not running"}
                </div>
                <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5 text-sm">
                  <li>Download the companion below.</li>
                  <li>
                    Unzip it and run <span className="text-foreground">Setup</span> once.
                  </li>
                  <li>It starts automatically when you open the tracker.</li>
                </ol>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <a href={COMPANION_DOWNLOAD_URL} download>
                      Download &amp; set up
                    </a>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      launchCompanion();
                    }}
                  >
                    Launch it
                  </Button>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={autoLaunch}
                  onChange={(event) => {
                    setAutoLaunch(event.target.checked);
                  }}
                />
                Launch automatically
              </label>
              <span className="text-muted-foreground pl-6 text-xs">
                Start the companion whenever the tracker is open (once it&apos;s set up).
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={profileSync}
                  onChange={(event) => {
                    setProfileSync(event.target.checked);
                  }}
                />
                Sync profile from game
              </label>
              <span className="text-muted-foreground pl-6 text-xs">
                Match the tracker to the character you&apos;re playing, creating a PvP/PvE profile
                if you don&apos;t have one yet.
              </span>
            </div>

            <p className="text-muted-foreground text-xs">
              Reads your EFT log files only. It never touches the game&apos;s files, memory, or
              process.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
