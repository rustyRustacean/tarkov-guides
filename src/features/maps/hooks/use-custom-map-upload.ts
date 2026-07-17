"use client";

import { useCallback } from "react";

import { toast } from "@/shared/ui/toast/toast-store";

import {
  generateCustomMapId,
  isImageFile,
  MAX_CUSTOM_MAP_IMAGE_BYTES,
  readFileAsDataUrl,
} from "../lib/custom-map-upload";
import { idbDelImage, idbPutImage } from "../persistence/custom-map-idb";
import { useMapsStore } from "../store";

export interface UseCustomMapUploadResult {
  /** Validates, reads, and persists a custom map image, then registers it as a variant of `normalizedName`. Resolves `false` (with a toast explaining why) on any validation/read/storage failure, `true` on success. */
  addCustomMap: (normalizedName: string, label: string, file: File) => Promise<boolean>;
  /** Deletes the image from IndexedDB (best-effort) and removes the variant metadata immediately - no confirmation prompt, per the Phase 5 step 12 plan's decision #3. */
  removeCustomMap: (normalizedName: string, variantId: string) => void;
}

/**
 * Orchestrates the custom-map-upload flow - validation, the IndexedDB
 * write/delete, and the store mutations - kept out of `useMapsStore` itself
 * (which stays pure state), matching this project's established "hooks own
 * side effects" convention (e.g. `progress-tracker/hooks/use-task-actions.ts`).
 */
export function useCustomMapUpload(): UseCustomMapUploadResult {
  const storeAddCustomMap = useMapsStore((state) => state.addCustomMap);
  const storeRemoveCustomMap = useMapsStore((state) => state.removeCustomMap);
  const setCustomMapImage = useMapsStore((state) => state.setCustomMapImage);

  const addCustomMap = useCallback(
    async (normalizedName: string, label: string, file: File): Promise<boolean> => {
      if (!isImageFile(file)) {
        toast({ message: "That file isn't an image." });
        return false;
      }
      if (file.size > MAX_CUSTOM_MAP_IMAGE_BYTES) {
        toast({ message: "Image is too large (max 15MB)." });
        return false;
      }

      let dataUrl: string;
      try {
        dataUrl = await readFileAsDataUrl(file);
      } catch {
        toast({ message: "Could not read that image file." });
        return false;
      }

      const id = generateCustomMapId();
      try {
        await idbPutImage(id, dataUrl);
      } catch {
        toast({ message: "Could not save the image - storage may be full." });
        return false;
      }

      setCustomMapImage(id, dataUrl);
      storeAddCustomMap(normalizedName, { id, label, custom: true });
      toast({ message: `Added "${label}"` });
      return true;
    },
    [setCustomMapImage, storeAddCustomMap],
  );

  const removeCustomMap = useCallback(
    (normalizedName: string, variantId: string): void => {
      storeRemoveCustomMap(normalizedName, variantId);
      idbDelImage(variantId).catch(() => {
        // Best-effort - the metadata (and image-cache entry, cleared by the
        // store's own removeCustomMap) is already gone either way, so a
        // stray orphaned IndexedDB entry is harmless and not worth
        // surfacing to the user.
      });
    },
    [storeRemoveCustomMap],
  );

  return { addCustomMap, removeCustomMap };
}
