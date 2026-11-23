"use client";

import { ClipboardCheck, Copy, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { copyToClipboard } from "@/shared/lib/clipboard";
import { Button } from "@/shared/ui/button/Button";
import { toast } from "@/shared/ui/toast/toast-store";

import { useItemCatalog } from "../../catalog/use-item-catalog";
import { useNamer } from "../../hooks/use-namer";
import { blankPreset } from "../../lib/defaults";
import { kitHash, STANDALONE_KIT_PATH } from "../../lib/kit-links";
import { deleteMyPreset, saveMyPreset, useMyPresets } from "../../lib/my-presets-storage";
import { emptyKit, parsePreset } from "../../lib/preset-schema";
import { EventUnavailable } from "../EventViewer";

import { PresetEditor } from "./PresetEditor";

import type { Preset } from "../../types";

/** The page path for editing one of My presets, or a new one. */
export function myPresetEditPath(id?: string): string {
  return `/resources/events/my-presets/edit${id ? `?id=${encodeURIComponent(id)}` : ""}`;
}

/** A link that opens the kit checker for this preset; the preset travels in the link. */
async function standaloneLink(preset: Preset): Promise<string> {
  return `${window.location.origin}${STANDALONE_KIT_PATH}${await kitHash(emptyKit(), preset)}`;
}

/**
 * Edits a preset kept in this browser ("My presets"), for reuse in events
 * or to share on its own as a kit check link. Saving never publishes it
 * anywhere.
 */
export function MyPresetWorkbench({ id }: { id: string | null }) {
  const router = useRouter();
  const { index, isPending } = useItemCatalog();
  const names = useNamer(index);
  const myPresets = useMyPresets();
  const [fresh] = useState(blankPreset);
  const [draft, setDraft] = useState<Preset | null>(null);
  const saved = id ? myPresets.find((preset) => preset.id === id) : undefined;
  const current = draft ?? saved ?? (id ? null : fresh);
  const dirty = draft !== null;

  if (isPending) return <p className="text-muted-foreground">Loading items...</p>;
  if (!index) {
    return (
      <EventUnavailable
        title="Items unavailable"
        body="The item list didn't load. Try refreshing."
      />
    );
  }
  if (!current) {
    return (
      <EventUnavailable
        title="Preset not found"
        body="It isn't saved in this browser. My presets live only in the browser they were made in."
      />
    );
  }

  const save = (): Preset | null => {
    const clean = parsePreset(current);
    if (!clean) {
      toast({ message: "Give the preset a name first." });
      return null;
    }
    saveMyPreset(clean);
    setDraft(null);
    if (clean.id !== id) router.replace(myPresetEditPath(clean.id));
    toast({ message: `Saved ${clean.name}` });
    return clean;
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-display mr-auto text-3xl font-bold">
          {saved ? "Edit preset" : "New preset"}
        </h1>
        <Button
          variant="outline"
          onClick={() => {
            const preset = dirty || !saved ? save() : saved;
            if (!preset) return;
            void standaloneLink(preset).then(async (link) => {
              const ok = await copyToClipboard(link);
              toast({ message: ok ? "Kit check link copied" : "Couldn't copy the link." });
            });
          }}
        >
          <Copy className="size-4" aria-hidden="true" />
          Copy kit check link
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            const preset = dirty || !saved ? save() : saved;
            if (!preset) return;
            void kitHash(emptyKit(), preset).then((hash) => {
              router.push(`${STANDALONE_KIT_PATH}${hash}`);
            });
          }}
        >
          <ClipboardCheck className="size-4" aria-hidden="true" />
          Check a kit
        </Button>
        {saved && (
          <Button
            variant="ghost"
            onClick={() => {
              deleteMyPreset(saved.id);
              router.push("/resources/events");
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </Button>
        )}
        <Button disabled={!dirty && Boolean(saved)} onClick={save}>
          Save
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Saved in this browser only. The kit check link carries the preset with it, so anyone can
        open it; later changes here don&apos;t change links already sent.
      </p>
      <PresetEditor preset={current} onChange={setDraft} index={index} names={names} />
    </div>
  );
}
