import { renderHook, waitFor } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { idbPutImage } from "../persistence/custom-map-idb";
import { useMapsStore } from "../store";

import { useMapVariants } from "./use-map-variants";

import type { MapVariant } from "../lib/map-config";

const initialMapsState = useMapsStore.getInitialState();

beforeEach(() => {
  useMapsStore.setState(initialMapsState, true);
  globalThis.indexedDB = new IDBFactory();
});

function baseVariant(overrides: Partial<MapVariant> = {}): MapVariant {
  return { id: "overview", label: "Overview", imageUrl: "/maps/svg/Reserve.svg", ...overrides };
}

describe("useMapVariants", () => {
  it("returns just the base variants when there are no custom uploads", () => {
    const { result } = renderHook(() => useMapVariants("reserve", [baseVariant()]));
    expect(result.current).toEqual([baseVariant()]);
  });

  it("lazily resolves a custom variant's image from IndexedDB and appends it once loaded", async () => {
    await idbPutImage("custom-1", "data:image/png;base64,AAAA");
    useMapsStore
      .getState()
      .addCustomMap("reserve", { id: "custom-1", label: "Mine", custom: true });

    const { result } = renderHook(() => useMapVariants("reserve", [baseVariant()]));

    expect(result.current).toEqual([baseVariant()]);
    await waitFor(() => {
      expect(result.current).toEqual([
        baseVariant(),
        { id: "custom-1", label: "Mine", imageUrl: "data:image/png;base64,AAAA", custom: true },
      ]);
    });
  });

  it("never surfaces a custom entry whose image is missing from IndexedDB", async () => {
    useMapsStore
      .getState()
      .addCustomMap("reserve", { id: "custom-orphan", label: "Orphan", custom: true });

    const { result } = renderHook(() => useMapVariants("reserve", [baseVariant()]));

    // Give the (resolving-to-undefined) IndexedDB lookup a chance to settle
    // before asserting the state genuinely never changes, not just that it
    // hasn't changed yet.
    await waitFor(() => {
      expect(result.current).toEqual([baseVariant()]);
    });
  });

  it("uses the already-cached image without a further IndexedDB read", () => {
    useMapsStore
      .getState()
      .addCustomMap("reserve", { id: "custom-1", label: "Mine", custom: true });
    useMapsStore.getState().setCustomMapImage("custom-1", "data:image/png;base64,CACHED");

    const { result } = renderHook(() => useMapVariants("reserve", [baseVariant()]));

    expect(result.current).toEqual([
      baseVariant(),
      { id: "custom-1", label: "Mine", imageUrl: "data:image/png;base64,CACHED", custom: true },
    ]);
  });
});
