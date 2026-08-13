"use client";

import { Check, Copy, Radio } from "lucide-react";
import { useState } from "react";

import { copyToClipboard } from "@/shared/lib/clipboard";
import { Button } from "@/shared/ui/button/Button";
import { Checkbox } from "@/shared/ui/checkbox/Checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";

import {
  COMPANION_DIAGNOSTIC_URL,
  COMPANION_DOWNLOAD_URL,
  COMPANION_INSTALL_COMMAND,
  COMPANION_SOURCE_URL,
  COMPANION_UNINSTALL_COMMAND,
  type CompanionMode,
} from "./companion-config";
import { DeviceSyncSection } from "./DeviceSyncSection";
import {
  launchCompanion,
  useAutoLaunchPreference,
  useCompanionStatus,
  useEverConnected,
} from "./use-companion";
import { useProfileSyncPreference } from "./use-companion-profile-sync";

const MODE_LABEL: Record<CompanionMode, string> = { pvp: "PvP", pve: "PvE" };

/**
 * A command shown for the user to run themselves, with a copy button.
 *
 * Shown rather than hidden behind a single "install" button on purpose: the
 * whole reason this replaced a downloadable executable is that a user can read
 * exactly what they are about to run. `select-all` means a click selects the
 * whole line for anyone who'd rather copy it by hand.
 */
function CommandLine({ command, label }: { command: string; label: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="border-border bg-background flex items-center gap-2 rounded border p-2">
      <code className="text-foreground min-w-0 flex-1 font-mono text-[11px] leading-4 break-all select-all">
        {command}
      </code>
      {/* A labelled button, not a bare icon: this is the one control in the
          panel the whole install depends on, and an icon alone was easy to
          miss against a wall of monospace. */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label={label}
        className="h-7 shrink-0 gap-1.5 px-2 text-xs"
        onClick={() => {
          void copyToClipboard(command).then((ok) => {
            if (!ok) return;
            setCopied(true);
            window.setTimeout(() => {
              setCopied(false);
            }, 1500);
          });
        }}
      >
        {copied ? (
          <>
            <Check className="text-status-teal h-3.5 w-3.5" aria-hidden="true" />
            Copied
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            Copy
          </>
        )}
      </Button>
    </div>
  );
}

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
  // `profileSync` defaults ON, so without `everConnected` this button would
  // poll `127.0.0.1` for every visitor on every page (this control lives in
  // the global header), tripping Chromium's "wants to access other apps and
  // services on this device" prompt before anyone ever touched the companion
  // feature. Same guard `useCompanionProfileSync`/`useCompanionTaskSync` use.
  const [everConnected] = useEverConnected();
  const { status, isConnected, isChecking } = useCompanionStatus(
    open || autoLaunch || (profileSync && everConnected),
  );

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
                  <dt>Companion</dt>
                  <dd className="text-foreground text-right">v{status.version}</dd>
                </dl>

                {/* The download stays reachable while it's running, because
                    that's exactly when you need it: updating is downloading the
                    zip again and re-running install.ps1, which stops the old
                    copy and replaces it. Hiding it behind "disconnect first"
                    would be backwards. */}
                <div className="border-border/60 mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                  <Button asChild variant="outline" size="sm">
                    <a href={COMPANION_DOWNLOAD_URL} download>
                      Download the zip
                    </a>
                  </Button>
                  <span className="text-muted-foreground text-xs">
                    To update, run <code className="font-mono">install.ps1</code> again - it
                    replaces the running copy.
                  </span>
                </div>
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
                {/* The download comes first because step 1 is "get the file":
                    putting the button under the steps meant reading the whole
                    list, then hunting back down the panel for it. */}
                <Button asChild size="sm" className="mt-3 w-full">
                  <a href={COMPANION_DOWNLOAD_URL} download>
                    Download the zip
                  </a>
                </Button>

                <ol className="text-muted-foreground mt-3 list-decimal space-y-2 pl-5 text-sm">
                  <li>
                    Extract it - right-click the zip →{" "}
                    <span className="text-foreground">Extract All</span>.
                  </li>
                  <li>
                    Right-click an empty spot inside the extracted folder →{" "}
                    <span className="text-foreground">Open in Terminal</span> (Windows 10:{" "}
                    <span className="text-foreground">Open PowerShell window here</span>).
                  </li>
                  <li>Paste this in and press Enter:</li>
                </ol>
                <div className="mt-2">
                  <CommandLine
                    command={COMPANION_INSTALL_COMMAND}
                    label="Copy the install command"
                  />
                </div>

                {/* A browser reports "refused this site's address" and "nothing
                    is listening" identically: both are just a failed fetch,
                    so this page can't tell the two apart. The companion's own
                    /diag page can, and opening it directly isn't a
                    cross-origin request, so it answers either way.

                    "Launch it" lives here rather than beside the download: it
                    only does anything once the companion is installed, so next
                    to a download button it reads like step two of setup. */}
                <p className="text-muted-foreground mt-2 text-xs">
                  Already installed it?{" "}
                  <button
                    type="button"
                    className="text-status-blue hover:underline"
                    onClick={() => {
                      launchCompanion();
                    }}
                  >
                    Start it
                  </button>{" "}
                  or{" "}
                  <a
                    href={COMPANION_DIAGNOSTIC_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-status-blue hover:underline"
                  >
                    check why it isn&apos;t connecting
                  </a>
                  .
                </p>

                {/* The permission is the one cause nobody finds on their own.
                    A browser that has "apps" blocked for this site swallows the
                    masttarkov:// hand-off silently: no error, no console
                    message, and the companion's own /diag reports it as never
                    having been contacted, which reads like the companion is at
                    fault. It is listed first because it is the cause that
                    actually turned up in the wild. */}
                <details className="group mt-2">
                  <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
                    It says this even though it IS running
                  </summary>
                  <ol className="text-muted-foreground mt-2 list-decimal space-y-1.5 pl-5 text-xs">
                    <li>
                      <span className="text-foreground">Check this site&apos;s permissions.</span>{" "}
                      Click the icon at the left of the address bar → site settings. If{" "}
                      <span className="text-foreground">Apps</span> (or &ldquo;Open external
                      apps&rdquo;) is set to <span className="text-foreground">Blocked</span>, allow
                      it and reload. A blocked setting here fails silently - nothing warns you.
                    </li>
                    <li>
                      Try a private window with extensions off - adblock and privacy extensions can
                      cancel the request.
                    </li>
                    <li>
                      Open the companion&apos;s own page:{" "}
                      <a
                        href={COMPANION_DIAGNOSTIC_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-status-blue hover:underline"
                      >
                        {COMPANION_DIAGNOSTIC_URL.replace("http://", "")}
                      </a>
                      . It says whether anything has ever reached it.
                    </li>
                  </ol>
                </details>

                <details className="group mt-2">
                  <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
                    How to remove it
                  </summary>
                  <p className="text-muted-foreground mt-2 text-xs">
                    Same folder, same terminal - this takes out the script, the log, the saved
                    settings, and the <code className="font-mono">masttarkov://</code> link. Nothing
                    is left behind, and your game files are never touched either way.
                  </p>
                  <div className="mt-1.5">
                    <CommandLine
                      command={COMPANION_UNINSTALL_COMMAND}
                      label="Copy the uninstall command"
                    />
                  </div>
                </details>
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
                Start it whenever this site is open. It doesn&apos;t run with Windows and shuts down
                on its own once you leave, so this is what wakes it.
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
                Match the tracker to the character you&apos;re playing and fill in your task
                progress from the game (creates a PvP/PvE profile if you don&apos;t have one yet).
              </span>
            </div>

            <DeviceSyncSection />

            {/* Outside both branches on purpose. This used to sit in the
                not-running panel, so the moment the companion connected the
                source link vanished: the code was only inspectable by people
                who hadn't run it yet, which is backwards. A claim about what
                software does should come with the software. */}
            <p className="text-muted-foreground text-xs">
              Reads your EFT log files only. It never touches the game&apos;s files, memory, or
              process. It&apos;s plain text, nothing compiled -{" "}
              <a
                href={COMPANION_SOURCE_URL}
                className="text-status-blue hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                read the script
              </a>
              .
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
