"use client";

import { useState } from "react";

import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";
import { Button } from "@/shared/ui/button/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog/Dialog";

import { useItemTracking } from "../hooks/use-item-tracking";

import type { NormalizedItem } from "@/shared/lib/tarkov-api/types";

export interface CustomItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const inputClassName =
  "border-border bg-background focus-visible:ring-ring rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

const MAX_RESULTS = 30;

/** Ranks name/shortName startsWith-matches before contains-matches, matching legacy's search modal. */
function searchItems(items: readonly NormalizedItem[], query: string): NormalizedItem[] {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length === 0) return [];
  const starts: NormalizedItem[] = [];
  const contains: NormalizedItem[] = [];
  for (const item of items) {
    const name = item.name.toLowerCase();
    const shortName = item.shortName.toLowerCase();
    if (name.startsWith(trimmed) || shortName.startsWith(trimmed)) {
      starts.push(item);
    } else if (name.includes(trimmed) || shortName.includes(trimmed)) {
      contains.push(item);
    }
  }
  return [...starts, ...contains].slice(0, MAX_RESULTS);
}

/**
 * Search-and-add a custom item, ported from legacy's `customItems.js`'s
 * search modal. Stores the real resolved tarkov.dev item id on the
 * `CustomItemEntry` (see `types.ts`'s `CustomItemEntry.id` doc comment) so
 * it shares a stash row with the same item if it's also required by a task.
 */
export function CustomItemDialog({ open, onOpenChange }: CustomItemDialogProps) {
  const { data } = useTarkovGameData();
  const { addCustomItem } = useItemTracking();

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<NormalizedItem | null>(null);
  const [need, setNeed] = useState(1);
  const [haveInitial, setHaveInitial] = useState(0);

  function resetForm(): void {
    setSearch("");
    setSelected(null);
    setNeed(1);
    setHaveInitial(0);
  }

  const results = selected ? [] : searchItems(data?.items ?? [], search);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Item</DialogTitle>
          <DialogDescription>
            Search the item catalog and add anything you want to track that isn&apos;t already
            required by an active quest.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Search Item
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setSelected(null);
              }}
              placeholder="Type to find…"
              autoComplete="off"
              className={inputClassName}
              aria-label="Search items"
            />
          </label>

          {selected ? (
            <div className="border-accent bg-background flex items-center gap-3 rounded-md border p-2 text-sm">
              {selected.iconLink && (
                // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon.
                <img src={selected.iconLink} alt="" className="h-8 w-8 object-contain" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{selected.name}</div>
                <div className="text-muted-foreground text-xs">Selected · {selected.shortName}</div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelected(null);
                }}
              >
                Change
              </Button>
            </div>
          ) : (
            results.length > 0 && (
              <ul className="border-border max-h-56 overflow-y-auto rounded-md border">
                {results.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(item);
                        setSearch(item.name);
                      }}
                      className="hover:bg-accent flex w-full items-center gap-3 border-b p-2 text-left text-sm last:border-b-0"
                    >
                      {item.iconLink && (
                        // eslint-disable-next-line @next/next/no-img-element -- external tarkov.dev-hosted icon.
                        <img src={item.iconLink} alt="" className="h-7 w-7 object-contain" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{item.name}</div>
                        <div className="text-muted-foreground text-xs">{item.shortName}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )
          )}

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm">
              Need
              <input
                type="number"
                min={1}
                value={need}
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10);
                  setNeed(Number.isFinite(parsed) && parsed >= 1 ? parsed : 1);
                }}
                className={inputClassName}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm">
              In Stash
              <input
                type="number"
                min={0}
                value={haveInitial}
                onChange={(event) => {
                  const parsed = Number.parseInt(event.target.value, 10);
                  setHaveInitial(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
                }}
                className={inputClassName}
              />
            </label>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              addCustomItem(
                { id: selected.id, name: selected.name, iconLink: selected.iconLink },
                need,
                haveInitial,
              );
              resetForm();
              onOpenChange(false);
            }}
          >
            Add Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
