"use client";

import { Copy, Download, Eye, MonitorPlay, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { PROFILE_MODE_LABELS } from "@/features/progress-tracker/types";
import { copyToClipboard } from "@/shared/lib/clipboard";
import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";
import { toast } from "@/shared/ui/toast/toast-store";

import { eventEditPath, eventOverlayPath, eventViewPath } from "../lib/event-code";
import { eventJson, exportFileStem, leaderboardCsv, raidLogCsv } from "../lib/export";
import { forgetEvent } from "../lib/my-events-storage";
import { hasSeparateBoards } from "../lib/scoring";

import { INPUT_CLASS, LABEL_CLASS } from "./event-ui";
import { NumberField } from "./NumberField";

import type { EventDocument } from "../types";
import type { LucideIcon } from "lucide-react";

function subscribeNever(): () => void {
  return () => undefined;
}

/** The page's origin once mounted ("" during SSR), for showing and copying full links. */
function useOrigin(): string {
  return useSyncExternalStore(
    subscribeNever,
    () => window.location.origin,
    () => "",
  );
}

function downloadText(fileName: string, mime: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function LinkRow({
  icon: Icon,
  title,
  description,
  url,
  warning,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  url: string;
  warning?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className="text-muted-foreground size-4" aria-hidden="true" />
        <span className="font-semibold">{title}</span>
      </div>
      <p className="text-muted-foreground text-sm">{description}</p>
      {warning && <p className="text-status-amber text-sm">{warning}</p>}
      <div className="flex gap-2">
        <input
          readOnly
          aria-label={`${title} URL`}
          className={`${INPUT_CLASS} font-mono text-xs`}
          value={url}
          onFocus={(event) => {
            event.target.select();
          }}
        />
        <Button
          variant="outline"
          onClick={() => {
            void copyToClipboard(url).then((ok) => {
              toast({
                message: ok ? `${title} copied` : "Couldn't copy. Select the link and copy it.",
              });
            });
          }}
        >
          <Copy className="size-4" aria-hidden="true" />
          Copy
        </Button>
      </div>
    </div>
  );
}

/** Links to hand out, exports, and the event's danger zone. Editors only. */
export function SharePanel({
  doc,
  code,
  editKey,
}: {
  doc: EventDocument;
  code: string;
  editKey: string;
}) {
  const origin = useOrigin();
  const router = useRouter();
  const separate = hasSeparateBoards(doc.settings);
  const [overlayMode, setOverlayMode] = useState<string>(doc.settings.modes[0] ?? "");
  const [overlayTop, setOverlayTop] = useState(10);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const stem = exportFileStem(doc.settings.name);

  const overlayUrl = `${origin}${eventOverlayPath(code, {
    ...(separate && overlayMode ? { mode: overlayMode } : {}),
    top: overlayTop,
  })}`;

  const deleteEvent = async () => {
    setDeleting(true);
    try {
      const response = await fetch(`/api/events/${code}/delete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ editKey }),
      });
      if (!response.ok) throw new Error(String(response.status));
      forgetEvent(code);
      toast({ message: `Deleted ${doc.settings.name}` });
      router.push("/resources/events");
    } catch {
      toast({ message: "Couldn't delete the event. Try again." });
      setDeleting(false);
    }
  };

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Links</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <LinkRow
            icon={Eye}
            title="View link"
            description="Anyone with this link sees the live leaderboard, raid log and teams. It refreshes on its own every few seconds. Safe to post publicly."
            url={`${origin}${eventViewPath(code)}`}
          />
          <a
            href={`${eventViewPath(code)}?as=viewer`}
            target="_blank"
            rel="noreferrer"
            className="text-primary -mt-4 self-start text-sm underline"
          >
            Preview what viewers see
          </a>
          <LinkRow
            icon={Pencil}
            title="Edit link"
            description="Gives full editing: scores, teams, settings, and deleting the event. Send it only to people scoring with you."
            warning="Don't post this one publicly or show it on stream."
            url={`${origin}${eventEditPath(code, editKey)}`}
          />
          <div className="flex flex-col gap-3">
            <LinkRow
              icon={MonitorPlay}
              title="Stream overlay"
              description="A compact leaderboard with a transparent background. In OBS, add a Browser source with this URL (about 600 x 500)."
              url={overlayUrl}
            />
            <div className="flex flex-wrap items-end gap-4">
              {separate && (
                <label className="flex flex-col gap-1">
                  <span className={LABEL_CLASS}>Board</span>
                  <select
                    className={INPUT_CLASS}
                    value={overlayMode}
                    onChange={(event) => {
                      setOverlayMode(event.target.value);
                    }}
                  >
                    {doc.settings.modes.map((mode) => (
                      <option key={mode} value={mode}>
                        {PROFILE_MODE_LABELS[mode]}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex flex-col gap-1">
                <label htmlFor="overlay-top" className={LABEL_CLASS}>
                  Teams shown
                </label>
                <NumberField
                  id="overlay-top"
                  className="w-24"
                  integer
                  min={1}
                  max={50}
                  value={overlayTop}
                  onChange={setOverlayTop}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Export</CardTitle>
          <CardDescription>
            CSV opens in Excel or Google Sheets. The JSON file can be imported later to start a copy
            of this event.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              downloadText(`${stem}-leaderboard.csv`, "text/csv", leaderboardCsv(doc));
            }}
          >
            <Download className="size-4" aria-hidden="true" />
            Leaderboard CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              downloadText(`${stem}-raid-log.csv`, "text/csv", raidLogCsv(doc));
            }}
          >
            <Download className="size-4" aria-hidden="true" />
            Raid log CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              downloadText(`${stem}.json`, "application/json", eventJson(doc));
            }}
          >
            <Download className="size-4" aria-hidden="true" />
            Event JSON
          </Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                forgetEvent(code);
                router.push(eventViewPath(code));
              }}
            >
              Forget on this browser
            </Button>
            <p className="text-muted-foreground text-sm">
              Removes the edit key from this browser only. You&apos;ll need the edit link to edit
              again.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDelete(true);
              }}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Delete event
            </Button>
            <p className="text-muted-foreground text-sm">
              Deletes it for everyone. Every link stops working.
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {doc.settings.name}?</DialogTitle>
            <DialogDescription>
              The scoreboard, teams and every logged raid are deleted for everyone, and the view,
              edit and overlay links stop working. This can&apos;t be undone. Export the JSON first
              if you might want it back.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmDelete(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => {
                void deleteEvent();
              }}
            >
              {deleting ? "Deleting..." : "Delete event"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
