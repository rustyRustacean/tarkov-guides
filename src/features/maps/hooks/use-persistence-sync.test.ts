import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { localStorageAdapter, STORAGE_KEY } from "../persistence/local-storage-adapter";
import { serializeSnapshot } from "../persistence/serialize";
import { useMapsStore } from "../store";

import { useMapsPersistenceSync } from "./use-persistence-sync";

const initialState = useMapsStore.getInitialState();

beforeEach(() => {
  useMapsStore.setState(initialState, true);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("useMapsPersistenceSync", () => {
  it("debounces writes on rapid store changes - a single write after the 500ms quiet period", () => {
    const writeSpy = vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
    renderHook(() => {
      useMapsPersistenceSync();
    });

    act(() => {
      useMapsStore.getState().setTopDollarThreshold(10_000);
      useMapsStore.getState().setTopDollarThreshold(20_000);
      useMapsStore.getState().setTopDollarThreshold(30_000);
    });
    expect(writeSpy).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(writeSpy).toHaveBeenCalledOnce();
  });

  it("flushes immediately (bypassing the debounce) when the document becomes hidden", () => {
    const writeSpy = vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
    const hiddenSpy = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    renderHook(() => {
      useMapsPersistenceSync();
    });

    act(() => {
      useMapsStore.getState().setTopDollarThreshold(10_000);
    });
    expect(writeSpy).not.toHaveBeenCalled();

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(writeSpy).toHaveBeenCalledOnce();
    hiddenSpy.mockRestore();
  });

  it("flushes on pagehide and beforeunload", () => {
    const writeSpy = vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
    renderHook(() => {
      useMapsPersistenceSync();
    });

    act(() => {
      useMapsStore.getState().setTopDollarThreshold(10_000);
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(writeSpy).toHaveBeenCalledOnce();

    act(() => {
      useMapsStore.getState().setTopDollarThreshold(20_000);
      window.dispatchEvent(new Event("beforeunload"));
    });
    expect(writeSpy).toHaveBeenCalledTimes(2);
  });

  it("unsubscribes and removes listeners on unmount - no write fires after unmount", () => {
    const writeSpy = vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
    const { unmount } = renderHook(() => {
      useMapsPersistenceSync();
    });
    unmount();

    act(() => {
      useMapsStore.getState().setTopDollarThreshold(10_000);
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

    /**
     * Regression test for the cross-tab data-loss bug: before
     * `useMapsPersistenceSync` was rebuilt on the shared
     * `useStorePersistenceSync` hook, Maps had no `storage`-event listener
     * at all, so two tabs open on the same profile could silently overwrite
     * each other's map annotations/task-display overrides. Mirrors
     * `progress-tracker`'s equivalent regression test, against
     * `useMapsStore`.
     */
    it("hydrates the store when another tab writes a newer snapshot - regression test for the cross-tab last-write-wins data-loss bug", () => {
      vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
      renderHook(() => {
        useMapsPersistenceSync();
      });
      expect(useMapsStore.getState().topDollarThresholdRub).toBe(
        initialState.topDollarThresholdRub,
      );

      const remoteSnapshot = serializeSnapshot({
        ...useMapsStore.getState(),
        topDollarThresholdRub: 99_999,
      });

      act(() => {
        dispatchRemoteWrite(JSON.stringify(remoteSnapshot));
      });

      expect(useMapsStore.getState().topDollarThresholdRub).toBe(99_999);
    });

    it("does not schedule a write back out after applying a remote change - regression test for a cross-tab echo/feedback loop", () => {
      const writeSpy = vi.spyOn(localStorageAdapter, "write").mockResolvedValue(undefined);
      renderHook(() => {
        useMapsPersistenceSync();
      });

      const remoteSnapshot = serializeSnapshot({
        ...useMapsStore.getState(),
        topDollarThresholdRub: 99_999,
      });
      act(() => {
        dispatchRemoteWrite(JSON.stringify(remoteSnapshot));
      });

      // A genuinely local change still schedules a debounced write as
      // usual, confirming the guard flag doesn't get stuck "on" after
      // handling the remote event. Only the remote-triggered hydrate
      // itself should never schedule one.
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(writeSpy).not.toHaveBeenCalled();

      act(() => {
        useMapsStore.getState().setTopDollarThreshold(10_000);
        vi.advanceTimersByTime(500);
      });
      expect(writeSpy).toHaveBeenCalledOnce();
    });

    it("ignores a storage event for a different key", () => {
      renderHook(() => {
        useMapsPersistenceSync();
      });
      const remoteSnapshot = serializeSnapshot({
        ...useMapsStore.getState(),
        topDollarThresholdRub: 99_999,
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

      expect(useMapsStore.getState().topDollarThresholdRub).toBe(
        initialState.topDollarThresholdRub,
      );
    });

    it("does not throw on a null newValue (key removed/cleared) or malformed JSON", () => {
      renderHook(() => {
        useMapsPersistenceSync();
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
      expect(useMapsStore.getState().topDollarThresholdRub).toBe(
        initialState.topDollarThresholdRub,
      );
    });

    it("stops reacting to storage events after unmount", () => {
      const { unmount } = renderHook(() => {
        useMapsPersistenceSync();
      });
      unmount();

      const remoteSnapshot = serializeSnapshot({
        ...useMapsStore.getState(),
        topDollarThresholdRub: 99_999,
      });
      act(() => {
        dispatchRemoteWrite(JSON.stringify(remoteSnapshot));
      });

      expect(useMapsStore.getState().topDollarThresholdRub).toBe(
        initialState.topDollarThresholdRub,
      );
    });
  });
});
