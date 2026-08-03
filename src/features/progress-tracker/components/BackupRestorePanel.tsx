"use client";

import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog/Dialog";

import { useBackupRestore } from "../hooks/use-backup-restore";
import { useFsaFolderLink } from "../hooks/use-fsa-folder-link";
import { useProgressTrackerStore } from "../store";

/**
 * Export/Import (manual JSON, Tier 3 of the persistence architecture),
 * Wipe, and - when the browser supports it (Chrome/Edge) - Link Backup
 * Folder (Tier 2, `fsa-folder-adapter.ts`). Unlike every other tab panel in
 * this feature, does NOT early-return on "no active profile" - Export/
 * Import/Link operate across all profiles and are meaningful regardless;
 * only Wipe (which is scoped to the active profile, matching
 * `wipeActiveProgress()`) is disabled without one.
 *
 * Both Import and Wipe are gated behind a real `Dialog` confirmation -
 * never `window.confirm()`, this project's established convention (see
 * `ProfileManagerDialog`'s delete flow, which explicitly cites this panel's
 * Wipe flow as the reason it didn't need its own nested dialog). Import
 * gets the same treatment even though it's a lower-friction action than
 * Wipe historically was in legacy: `store.hydrate()` replaces state across
 * every profile, and the pre-import state has no automatic backup once the
 * debounced auto-sync writes over it - at least as consequential as Wipe.
 *
 * The Link Backup Folder control is entirely ABSENT (not disabled) when
 * the File System Access API isn't supported - Firefox/Safari never see
 * it. Linking can surface a conflict (the chosen folder already has a
 * backup that differs from local progress) - resolved via a second real
 * `Dialog` (Replace vs. Keep local), never `window.confirm()`.
 */
export function BackupRestorePanel() {
  const hasActiveProfile = useProgressTrackerStore((state) => state.activeProfileId !== null);
  const { exportBackup, importBackup, wipeProgress, clearAllData } = useBackupRestore();
  const {
    isSupported: isFolderLinkSupported,
    status: folderStatus,
    pendingConflict,
    link: linkFolder,
    resolveConflict,
    unlinkFolder,
    reconnect,
  } = useFsaFolderLink();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backup & Restore</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Progress auto-saves to this browser. Export a backup to keep a copy, or restore one below.
        </p>

        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={exportBackup}>
            Export Backup
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="outline">
                Import Backup
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Replace current progress?</DialogTitle>
                <DialogDescription>
                  Importing will replace ALL profiles and progress with the contents of the backup
                  file. This cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    type="button"
                    onClick={() => {
                      void importBackup();
                    }}
                  >
                    Choose File &amp; Replace
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="destructive" disabled={!hasActiveProfile}>
                Wipe Progress
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Wipe progress?</DialogTitle>
                <DialogDescription>
                  This clears all quest, item, hideout, and Kappa progress for the active profile.
                  This cannot be undone. Consider exporting a backup first.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button type="button" variant="destructive" onClick={wipeProgress}>
                    Confirm Wipe
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button type="button" variant="destructive">
                Clear All Data
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clear everything in this browser?</DialogTitle>
                <DialogDescription>
                  This removes every profile and all of their progress from this browser, leaving it
                  as if you&apos;d never been here - which is what you want before letting the EFT
                  Companion fill your tasks in from the game. Your map drawings, theme, and
                  companion settings are kept. This cannot be undone; export a backup first if
                  you&apos;re unsure.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button type="button" variant="destructive" onClick={clearAllData}>
                    Clear Everything
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {isFolderLinkSupported &&
            (folderStatus ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  linked: <span className="text-foreground font-medium">{folderStatus.name}</span> ·
                  permission: {folderStatus.permission}
                </span>
                {folderStatus.permission !== "granted" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      void reconnect();
                    }}
                  >
                    Reconnect
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void unlinkFolder();
                  }}
                >
                  Unlink
                </Button>
              </div>
            ) : (
              <Dialog>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline">
                    Link Backup Folder
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Link a backup folder</DialogTitle>
                    <DialogDescription>
                      Progress will auto-save to a file in a folder you choose, in addition to this
                      browser. Chrome won&apos;t let you pick a protected folder (like Documents)
                      directly - create or choose a subfolder instead.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">
                        Cancel
                      </Button>
                    </DialogClose>
                    <DialogClose asChild>
                      <Button
                        type="button"
                        onClick={() => {
                          void linkFolder();
                        }}
                      >
                        Choose Folder
                      </Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            ))}
        </div>

        <Dialog open={pendingConflict !== null}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Backup folder conflict</DialogTitle>
              <DialogDescription>
                This folder already has a backup that differs from your current progress. Replace
                your current progress with the folder&apos;s backup, or keep your current progress
                and overwrite the folder&apos;s file?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void resolveConflict("keep-local");
                }}
              >
                Keep Local, Overwrite Folder
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void resolveConflict("replace");
                }}
              >
                Replace With Folder&apos;s Backup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
