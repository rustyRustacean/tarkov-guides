import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useToastStore } from "@/shared/ui/toast/toast-store";

import { MAX_CUSTOM_MAP_IMAGE_BYTES } from "../lib/custom-map-upload";
import { idbDelImage, idbGetImage, idbPutImage } from "../persistence/custom-map-idb";
import { useMapsStore } from "../store";

import { useCustomMapUpload } from "./use-custom-map-upload";

vi.mock("../persistence/custom-map-idb", () => ({
  idbGetImage: vi.fn(),
  idbPutImage: vi.fn(),
  idbDelImage: vi.fn(),
}));

const initialMapsState = useMapsStore.getInitialState();

beforeEach(() => {
  useMapsStore.setState(initialMapsState, true);
  useToastStore.setState({ toast: null });
  vi.mocked(idbPutImage).mockReset().mockResolvedValue(undefined);
  vi.mocked(idbDelImage).mockReset().mockResolvedValue(undefined);
  vi.mocked(idbGetImage).mockReset().mockResolvedValue(undefined);
});

function makeImageFile(overrides: { size?: number } = {}): File {
  const file = new File(["fake-image-bytes"], "map.png", { type: "image/png" });
  if (overrides.size !== undefined) {
    Object.defineProperty(file, "size", { value: overrides.size });
  }
  return file;
}

describe("useCustomMapUpload", () => {
  describe("addCustomMap", () => {
    it("rejects a non-image file without writing to IndexedDB or the store", async () => {
      const { result } = renderHook(() => useCustomMapUpload());
      const file = new File(["{}"], "data.json", { type: "application/json" });

      let ok = true;
      await act(async () => {
        ok = await result.current.addCustomMap("reserve", "Mine", file);
      });

      expect(ok).toBe(false);
      expect(idbPutImage).not.toHaveBeenCalled();
      expect(useMapsStore.getState().customMaps.reserve).toBeUndefined();
      expect(useToastStore.getState().toast?.message).toMatch(/isn't an image/);
    });

    it("rejects a file over the size cap", async () => {
      const { result } = renderHook(() => useCustomMapUpload());
      const file = makeImageFile({ size: MAX_CUSTOM_MAP_IMAGE_BYTES + 1 });

      let ok = true;
      await act(async () => {
        ok = await result.current.addCustomMap("reserve", "Mine", file);
      });

      expect(ok).toBe(false);
      expect(idbPutImage).not.toHaveBeenCalled();
      expect(useToastStore.getState().toast?.message).toMatch(/too large/);
    });

    it("on success: writes to IndexedDB, caches the image, registers the variant, and toasts", async () => {
      const { result } = renderHook(() => useCustomMapUpload());
      const file = makeImageFile();

      let ok = false;
      await act(async () => {
        ok = await result.current.addCustomMap("reserve", "My callouts", file);
      });

      expect(ok).toBe(true);
      expect(idbPutImage).toHaveBeenCalledTimes(1);
      const [id, dataUrl] = vi.mocked(idbPutImage).mock.calls[0] as [string, string];
      expect(id).toMatch(/^custom-/);
      expect(dataUrl).toMatch(/^data:image\/png;base64,/);

      expect(useMapsStore.getState().customMapImageCache[id]).toBe(dataUrl);
      expect(useMapsStore.getState().customMaps.reserve).toEqual([
        { id, label: "My callouts", custom: true },
      ]);
      expect(useToastStore.getState().toast?.message).toMatch(/Added "My callouts"/);
    });

    it("returns false and toasts when the IndexedDB write fails", async () => {
      vi.mocked(idbPutImage).mockRejectedValue(new Error("quota exceeded"));
      const { result } = renderHook(() => useCustomMapUpload());
      const file = makeImageFile();

      let ok = true;
      await act(async () => {
        ok = await result.current.addCustomMap("reserve", "Mine", file);
      });

      expect(ok).toBe(false);
      expect(useMapsStore.getState().customMaps.reserve).toBeUndefined();
      expect(useToastStore.getState().toast?.message).toMatch(/Could not save/);
    });
  });

  describe("removeCustomMap", () => {
    it("removes the variant metadata immediately and deletes the IndexedDB entry", async () => {
      useMapsStore
        .getState()
        .addCustomMap("reserve", { id: "custom-1", label: "Mine", custom: true });
      const { result } = renderHook(() => useCustomMapUpload());

      act(() => {
        result.current.removeCustomMap("reserve", "custom-1");
      });

      expect(useMapsStore.getState().customMaps.reserve).toEqual([]);
      await waitFor(() => {
        expect(idbDelImage).toHaveBeenCalledWith("custom-1");
      });
    });

    it("still removes the metadata even if the IndexedDB delete fails", async () => {
      vi.mocked(idbDelImage).mockRejectedValue(new Error("not found"));
      useMapsStore
        .getState()
        .addCustomMap("reserve", { id: "custom-1", label: "Mine", custom: true });
      const { result } = renderHook(() => useCustomMapUpload());

      act(() => {
        result.current.removeCustomMap("reserve", "custom-1");
      });

      expect(useMapsStore.getState().customMaps.reserve).toEqual([]);
      await waitFor(() => {
        expect(idbDelImage).toHaveBeenCalledWith("custom-1");
      });
    });
  });
});
