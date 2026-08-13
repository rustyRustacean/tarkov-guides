import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMapsStore } from "../store";

import { useMapUrlParam } from "./use-map-url-param";

const replace = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/maps",
  useSearchParams: () => currentSearchParams,
}));

const initialState = useMapsStore.getInitialState();

describe("useMapUrlParam", () => {
  beforeEach(() => {
    replace.mockClear();
    currentSearchParams = new URLSearchParams();
    useMapsStore.setState(initialState, true);
  });

  it("does nothing when there's no map param", () => {
    renderHook(() => {
      useMapUrlParam();
    });
    expect(replace).not.toHaveBeenCalled();
    expect(useMapsStore.getState().currentMap).toBe(initialState.currentMap);
  });

  it("applies a valid ?map= param to the store and strips it from the URL", async () => {
    currentSearchParams = new URLSearchParams("map=woods");
    renderHook(() => {
      useMapUrlParam();
    });

    expect(replace).toHaveBeenCalledExactlyOnceWith("/maps", { scroll: false });
    // Applied via `setTimeout(fn, 0)`; see the hook's doc comment for why.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useMapsStore.getState().currentMap).toBe("woods");
  });

  it("preserves other params when stripping map", async () => {
    currentSearchParams = new URLSearchParams("map=woods&foo=bar");
    renderHook(() => {
      useMapUrlParam();
    });
    expect(replace).toHaveBeenCalledExactlyOnceWith("/maps?foo=bar", { scroll: false });
    // Drain the pending `setCurrentMap` timeout so it can't leak into a
    // later test; see the previous test's comment.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("strips an unrecognized map id from the URL without touching the store", async () => {
    currentSearchParams = new URLSearchParams("map=not-a-real-map");
    renderHook(() => {
      useMapUrlParam();
    });

    expect(replace).toHaveBeenCalledExactlyOnceWith("/maps", { scroll: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useMapsStore.getState().currentMap).toBe(initialState.currentMap);
  });

  it("only applies once for the same param value even if the effect re-runs", async () => {
    currentSearchParams = new URLSearchParams("map=woods");
    const { rerender } = renderHook(() => {
      useMapUrlParam();
    });
    rerender();
    rerender();

    expect(replace).toHaveBeenCalledOnce();
    // Drain the pending `setCurrentMap` timeout so it can't leak into a
    // later test; see the first param-applying test's comment.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
