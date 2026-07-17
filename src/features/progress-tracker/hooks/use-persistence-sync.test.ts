import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fsaFolderAdapter } from "../persistence/fsa-folder-adapter";
import { localStorageAdapter } from "../persistence/local-storage-adapter";
import { useProgressTrackerStore } from "../store";

import { usePersistenceSync } from "./use-persistence-sync";

const initialState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
  vi.useFakeTimers();
  // Always stubbed, even in tests that don't assert on it directly - jsdom
  // has no native IndexedDB, so an unmocked call would reject.
  vi.spyOn(fsaFolderAdapter, "write").mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("usePersistenceSync", () => {
  it("debounces writes on rapid store changes - a single write after the 500ms quiet period", () => {
    const writeSpy = vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
    renderHook(() => {
      usePersistenceSync();
    });

    act(() => {
      useProgressTrackerStore.getState().setAutoStartNext(false);
      useProgressTrackerStore.getState().setAutoStartNext(true);
      useProgressTrackerStore.getState().setAutoStartNext(false);
    });
    expect(writeSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(writeSpy).toHaveBeenCalledOnce();
    // Tier 2 rides the exact same debounced flush as Tier 1 - no separate timer.
    expect(fsaFolderAdapter.write).toHaveBeenCalledOnce();
  });

  it("flushes immediately (bypassing the debounce) when the document becomes hidden", () => {
    const writeSpy = vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
    const hiddenSpy = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    renderHook(() => {
      usePersistenceSync();
    });

    act(() => {
      useProgressTrackerStore.getState().setAutoStartNext(false);
    });
    expect(writeSpy).not.toHaveBeenCalled();

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(writeSpy).toHaveBeenCalledOnce();
    hiddenSpy.mockRestore();
  });

  it("does not flush on visibilitychange while the document is still visible", () => {
    const writeSpy = vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    renderHook(() => {
      usePersistenceSync();
    });

    act(() => {
      useProgressTrackerStore.getState().setAutoStartNext(false);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it("flushes on pagehide and beforeunload", () => {
    const writeSpy = vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
    renderHook(() => {
      usePersistenceSync();
    });

    act(() => {
      useProgressTrackerStore.getState().setAutoStartNext(false);
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(writeSpy).toHaveBeenCalledOnce();

    act(() => {
      useProgressTrackerStore.getState().setAutoStartNext(true);
      window.dispatchEvent(new Event("beforeunload"));
    });
    expect(writeSpy).toHaveBeenCalledTimes(2);
  });

  it("unsubscribes and removes listeners on unmount - no write fires after unmount", () => {
    const writeSpy = vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
    const { unmount } = renderHook(() => {
      usePersistenceSync();
    });
    unmount();

    act(() => {
      useProgressTrackerStore.getState().setAutoStartNext(false);
      vi.advanceTimersByTime(1000);
    });
    expect(writeSpy).not.toHaveBeenCalled();
  });
});
