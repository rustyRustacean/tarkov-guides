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

import { useCustomMapUpload } from "../hooks/use-custom-map-upload";

const inputClassName =
  "border-border bg-background focus-visible:ring-ring rounded-md border px-3 py-1.5 text-sm focus-visible:ring-2 focus-visible:outline-none";

export interface AddCustomMapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  normalizedName: string;
}

/**
 * Upload your own image (screenshot, callout sheet) as an extra variant of
 * the currently-open map - ported from `old/TarkovTrackerWB-main/src/lib/
 * mapsConfig.js`'s Settings-screen "CUSTOM MAPS" form, scoped to the
 * current map rather than a map-level `<select>` (per the Phase 5 step 12
 * plan's decision #2 - this dialog is opened from the map screen itself,
 * not a global Settings form, so "which map" is already implied). Follows
 * `CustomItemDialog.tsx`'s established scaffold (reset-on-close, submit
 * disabled until valid).
 */
export function AddCustomMapDialog({
  open,
  onOpenChange,
  normalizedName,
}: AddCustomMapDialogProps) {
  const { addCustomMap } = useCustomMapUpload();

  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resetForm(): void {
    setLabel("");
    setFile(null);
    setSubmitting(false);
  }

  const canSubmit = label.trim().length > 0 && file !== null && !submitting;

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
          <DialogTitle>Add Custom Map</DialogTitle>
          <DialogDescription>
            Upload your own image (a screenshot, an annotated callout sheet) as an extra variant of
            this map. Stored permanently in this browser.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Variant Name
            <input
              type="text"
              value={label}
              onChange={(event) => {
                setLabel(event.target.value);
              }}
              placeholder="e.g. My callouts"
              maxLength={40}
              autoComplete="off"
              className={inputClassName}
              aria-label="Variant name"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Image File
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
              }}
              className="text-sm"
              aria-label="Image file"
            />
          </label>
        </div>

        <DialogFooter className="mt-4">
          <Button
            type="button"
            disabled={!canSubmit}
            onClick={() => {
              if (!file) return;
              setSubmitting(true);
              void addCustomMap(normalizedName, label.trim(), file).then((ok) => {
                if (ok) {
                  resetForm();
                  onOpenChange(false);
                } else {
                  setSubmitting(false);
                }
              });
            }}
          >
            {submitting ? "Adding…" : "Add Map"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
