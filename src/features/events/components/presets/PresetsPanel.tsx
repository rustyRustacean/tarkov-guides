"use client";

import { BookmarkPlus, ClipboardCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/shared/ui/button/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card/Card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";
import { toast } from "@/shared/ui/toast/toast-store";
import { TransitionLink } from "@/shared/ui/transition-link/TransitionLink";

import { useItemCatalog } from "../../catalog/use-item-catalog";
import { useNamer } from "../../hooks/use-namer";
import { blankPreset, newId } from "../../lib/defaults";
import { EVENT_LIMITS } from "../../lib/event-schema";
import { eventKitPath } from "../../lib/kit-links";
import { saveMyPreset, useMyPresets } from "../../lib/my-presets-storage";
import { parsePreset } from "../../lib/preset-schema";
import { INPUT_CLASS, LABEL_CLASS } from "../event-ui";

import { PresetEditor } from "./PresetEditor";
import { PresetSummary } from "./PresetSummary";

import type { EventEditor } from "../../room/use-event-editor";
import type { EventDocument, Preset } from "../../types";

/** Players assigned to each role, as "Team: Player" labels. */
function assignments(doc: EventDocument): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const team of Object.values(doc.teams).sort((a, b) => a.order - b.order)) {
    team.players.forEach((player, i) => {
      if (!player.roleId) return;
      const label = `${team.name}: ${player.name || `Player ${String(i + 1)}`}`;
      const list = out.get(player.roleId);
      if (list) list.push(label);
      else out.set(player.roleId, [label]);
    });
  }
  return out;
}

/**
 * The event's role presets (e.g. "Bolt-action specialist" and "DMR
 * specialist" for a duo). Everyone can read them and open the kit checker
 * for a role; editors add, edit and remove them, starting blank or from a
 * preset saved in this browser. Players get their role on the Teams tab.
 */
export function PresetsPanel({
  doc,
  code,
  editor,
}: {
  doc: EventDocument;
  code: string;
  editor?: EventEditor;
}) {
  const { index, isPending, isError } = useItemCatalog();
  const names = useNamer(index);
  const myPresets = useMyPresets();
  const [draft, setDraft] = useState<Preset | null>(null);
  const [fromMine, setFromMine] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Preset | null>(null);
  const fromMineId = useId();
  const presets = Object.values(doc.presets);
  const assigned = assignments(doc);
  const atLimit = presets.length >= EVENT_LIMITS.presets;

  if (draft && editor && index) {
    const isNew = !(draft.id in doc.presets);
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display mr-auto text-xl font-bold">
            {isNew ? "New role preset" : `Editing ${doc.presets[draft.id]?.name ?? draft.name}`}
          </h2>
          <Button
            variant="outline"
            onClick={() => {
              setDraft(null);
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              const clean = parsePreset(draft);
              if (!clean) {
                toast({ message: "Give the preset a name first." });
                return;
              }
              editor.upsertPreset(
                clean,
                `${isNew ? "Added" : "Updated"} role preset ${clean.name}`,
              );
              setDraft(null);
            }}
          >
            Save preset
          </Button>
        </div>
        <PresetEditor preset={draft} onChange={setDraft} index={index} names={names} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground max-w-3xl text-sm">
        Each role preset lists what a player in that role may bring. Open the kit checker to build a
        kit and see whether it follows the rules, then send the kit link to the organizers.
      </p>

      {editor && !atLimit && (
        <div className="flex flex-wrap items-end gap-3">
          <Button
            disabled={!index}
            onClick={() => {
              setDraft(blankPreset());
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            New role preset
          </Button>
          {myPresets.length > 0 && (
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <label htmlFor={fromMineId} className={LABEL_CLASS}>
                  Or start from one of my presets
                </label>
                <select
                  id={fromMineId}
                  className={INPUT_CLASS}
                  value={fromMine}
                  onChange={(event) => {
                    setFromMine(event.target.value);
                  }}
                >
                  <option value="">Pick a preset</option>
                  {myPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                variant="outline"
                disabled={!fromMine || !index}
                onClick={() => {
                  const source = myPresets.find((preset) => preset.id === fromMine);
                  // A fresh id: the event's copy is its own, editing it never changes the saved one.
                  if (source) setDraft({ ...source, id: newId() });
                  setFromMine("");
                }}
              >
                Use it
              </Button>
            </div>
          )}
        </div>
      )}

      {isError && (
        <p className="text-status-amber text-sm">
          The item catalog didn&apos;t load, so category names and icons may be missing. Try
          refreshing.
        </p>
      )}

      {presets.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {editor ? "No role presets yet." : "This event has no role presets."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {presets.map((preset) => (
            <Card key={preset.id}>
              <CardHeader className="flex flex-row flex-wrap items-start gap-2">
                <div className="mr-auto flex flex-col gap-1">
                  <CardTitle>{preset.name}</CardTitle>
                  <p className="text-muted-foreground text-xs">
                    {assigned.get(preset.id)?.join(" · ") ?? "Not assigned to anyone yet"}
                  </p>
                </div>
                <Button asChild size="sm">
                  <TransitionLink href={eventKitPath(code, preset.id)}>
                    <ClipboardCheck className="size-4" aria-hidden="true" />
                    Check a kit
                  </TransitionLink>
                </Button>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {isPending ? (
                  <p className="text-muted-foreground text-sm">Loading items...</p>
                ) : (
                  <PresetSummary preset={preset} index={index} names={names} />
                )}
                {editor && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!index}
                      onClick={() => {
                        setDraft(preset);
                      }}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        saveMyPreset({ ...preset, id: newId() });
                        toast({ message: `Saved ${preset.name} to My presets` });
                      }}
                    >
                      <BookmarkPlus className="size-4" aria-hidden="true" />
                      Save to my presets
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setPendingDelete(preset);
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Remove
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {pendingDelete?.name}?</DialogTitle>
            <DialogDescription>
              {pendingDelete && assigned.has(pendingDelete.id)
                ? `${String(assigned.get(pendingDelete.id)?.length ?? 0)} assigned players will have no role. Kit links for this role stop working.`
                : "Kit links for this role stop working."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPendingDelete(null);
              }}
            >
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingDelete && editor) editor.deletePreset(pendingDelete);
                setPendingDelete(null);
              }}
            >
              Remove preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
