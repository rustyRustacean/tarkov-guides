import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fsaFolderAdapter } from "../persistence/fsa-folder-adapter";
import { localStorageAdapter, STORAGE_KEY } from "../persistence/local-storage-adapter";
import { serializeSnapshot } from "../persistence/serialize";
import { useProgressTrackerStore } from "../store";

import { usePersistenceSync } from "./use-persistence-sync";

const initialState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
  vi.useFakeTimers();
  // Always stubbed, even when a test doesn't assert on it directly: jsdom
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
    // Tier 2 rides the same debounced flush as Tier 1; no separate timer.
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

  describe("cross-tab sync via the storage event", () => {
    function dispatchRemoteWrite(newValue: string | null): void {
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY, newValue, storageArea: localStorage }),
      );
    }

    it("hydrates the store when another tab writes a newer snapshot - regression test for the cross-tab last-write-wins data-loss bug", () => {
      vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
      renderHook(() => {
        usePersistenceSync();
      });
      expect(useProgressTrackerStore.getState().autoStartNext).toBe(true);

      const remoteSnapshot = serializeSnapshot({
        ...useProgressTrackerStore.getState(),
        autoStartNext: false,
      });

      act(() => {
        dispatchRemoteWrite(JSON.stringify(remoteSnapshot));
      });

      expect(useProgressTrackerStore.getState().autoStartNext).toBe(false);
    });

    it("does not schedule a write back out after applying a remote change - regression test for a cross-tab echo/feedback loop", () => {
      const writeSpy = vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
      renderHook(() => {
        usePersistenceSync();
      });

      const remoteSnapshot = serializeSnapshot({
        ...useProgressTrackerStore.getState(),
        autoStartNext: false,
      });
      act(() => {
        dispatchRemoteWrite(JSON.stringify(remoteSnapshot));
      });

      // A genuinely local change still schedules a debounced write (the guard
      // flag doesn't get stuck "on" after the remote event); only the
      // remote-triggered hydrate itself skips scheduling one.
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(writeSpy).not.toHaveBeenCalled();

      act(() => {
        useProgressTrackerStore.getState().setAutoStartNext(true);
        vi.advanceTimersByTime(500);
      });
      expect(writeSpy).toHaveBeenCalledOnce();
    });

    it("ignores a storage event for a different key", () => {
      renderHook(() => {
        usePersistenceSync();
      });
      const remoteSnapshot = serializeSnapshot({
        ...useProgressTrackerStore.getState(),
        autoStartNext: false,
      });

      act(() => {
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: "some-other-app.other-key",
            newValue: JSON.stringify(remoteSnapshot),
            storageArea: localStorage,
          }),
        );
      });

      expect(useProgressTrackerStore.getState().autoStartNext).toBe(true);
    });

    it("does not throw on a null newValue (key removed/cleared) or malformed JSON", () => {
      renderHook(() => {
        usePersistenceSync();
      });

      expect(() => {
        act(() => {
          dispatchRemoteWrite(null);
        });
      }).not.toThrow();
      expect(() => {
        act(() => {
          dispatchRemoteWrite("{not valid json");
        });
      }).not.toThrow();
      expect(useProgressTrackerStore.getState().autoStartNext).toBe(true);
    });

    it("stops reacting to storage events after unmount", () => {
      const { unmount } = renderHook(() => {
        usePersistenceSync();
      });
      unmount();

      const remoteSnapshot = serializeSnapshot({
        ...useProgressTrackerStore.getState(),
        autoStartNext: false,
      });
      act(() => {
        dispatchRemoteWrite(JSON.stringify(remoteSnapshot));
      });

      expect(useProgressTrackerStore.getState().autoStartNext).toBe(true);
    });
  });
});
