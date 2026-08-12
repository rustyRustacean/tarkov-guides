import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { localStorageAdapter } from "../persistence/local-storage-adapter";
import { useProgressTrackerStore } from "../store";
import { emptyProfileProgress } from "../types";

import { useHydrateOnMount } from "./use-hydrate-on-mount";

import type { ProgressTrackerSnapshot } from "../persistence/types";

const initialState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useHydrateOnMount", () => {
  it("hydrates the store from a persisted snapshot on mount", async () => {
    const snapshot: ProgressTrackerSnapshot = {
      schemaVersion: 1,
      exportedAt: "2026-07-10T00:00:00.000Z",
      profiles: [{ id: "p1", name: "PMC", face: null }],
      activeProfileId: "p1",
      activeMode: "PVP",
      progressByProfile: { "p1:PVP": emptyProfileProgress("BEAR") },
      autoStartNext: true,
    };
    vi.spyOn(localStorageAdapter, "read").mockResolvedValue(snapshot);

    renderHook(() => {
      useHydrateOnMount();
    });

    await waitFor(() => {
      expect(useProgressTrackerStore.getState().activeProfileId).toBe("p1");
    });
    expect(useProgressTrackerStore.getState().profiles).toEqual(snapshot.profiles);
  });

  it("is a no-op when nothing was ever persisted (read resolves null)", async () => {
    const readSpy = vi.spyOn(localStorageAdapter, "read").mockResolvedValue(null);

    renderHook(() => {
      useHydrateOnMount();
    });

    await waitFor(() => {
      expect(readSpy).toHaveBeenCalledOnce();
    });
    expect(useProgressTrackerStore.getState().profiles).toEqual([]);
  });

  it("does not hydrate if the component unmounts before the read resolves", async () => {
    let resolveRead: (value: ProgressTrackerSnapshot | null) => void = () => undefined;
    vi.spyOn(localStorageAdapter, "read").mockReturnValue(
      new Promise((resolve) => {
        resolveRead = resolve;
      }),
    );

    const { unmount } = renderHook(() => {
      useHydrateOnMount();
    });
    unmount();

    resolveRead({
      schemaVersion: 1,
      exportedAt: "2026-07-10T00:00:00.000Z",
      profiles: [{ id: "p1", name: "PMC", face: null }],
      activeProfileId: "p1",
      activeMode: "PVP",
      progressByProfile: { "p1:PVP": emptyProfileProgress("BEAR") },
      autoStartNext: true,
    });

    // Give the resolved promise's microtask a turn to run, then confirm no hydrate happened.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(useProgressTrackerStore.getState().activeProfileId).toBeNull();
  });
});
