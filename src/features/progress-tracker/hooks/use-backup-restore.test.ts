import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useToastStore } from "@/shared/ui/toast/toast-store";

import { manualJsonAdapter } from "../persistence/manual-json-adapter";
import { useProgressTrackerStore } from "../store";

import { useBackupRestore } from "./use-backup-restore";

import type { ProgressTrackerSnapshot } from "../persistence/types";

const initialState = useProgressTrackerStore.getInitialState();

function makeSnapshot(overrides: Partial<ProgressTrackerSnapshot> = {}): ProgressTrackerSnapshot {
  return {
    schemaVersion: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    profiles: [{ id: "p1", name: "Imported", mode: "PVP", faction: "BEAR", face: null }],
    activeProfileId: "p1",
    progressByProfile: {},
    autoStartNext: true,
    ...overrides,
  };
}

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
  useToastStore.setState({ toast: null });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useBackupRestore", () => {
  it("exportBackup writes a snapshot of the current state and toasts", () => {
    const writeSpy = vi.spyOn(manualJsonAdapter, "write").mockResolvedValue(undefined);
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderHook(() => useBackupRestore());
    act(() => {
      result.current.exportBackup();
    });

    expect(writeSpy).toHaveBeenCalledOnce();
    const snapshot = writeSpy.mock.calls[0]?.[0];
    expect(snapshot?.profiles).toHaveLength(1);
    expect(snapshot?.profiles[0]?.name).toBe("PMC");
    expect(useToastStore.getState().toast?.message).toBe("Backup exported");
  });

  it("importBackup hydrates the store and toasts on a successful read", async () => {
    const snapshot = makeSnapshot();
    vi.spyOn(manualJsonAdapter, "read").mockResolvedValue(snapshot);

    const { result } = renderHook(() => useBackupRestore());
    await act(async () => {
      await result.current.importBackup();
    });

    expect(useProgressTrackerStore.getState().profiles).toEqual(snapshot.profiles);
    expect(useProgressTrackerStore.getState().activeProfileId).toBe("p1");
    expect(useToastStore.getState().toast?.message).toBe("Backup restored");
  });

  it("importBackup is a silent no-op when read() resolves null (cancel or bad file)", async () => {
    vi.spyOn(manualJsonAdapter, "read").mockResolvedValue(null);
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { result } = renderHook(() => useBackupRestore());
    await act(async () => {
      await result.current.importBackup();
    });

    expect(useProgressTrackerStore.getState().profiles.map((p) => p.name)).toEqual(["PMC"]);
    expect(useToastStore.getState().toast).toBeNull();
  });

  it("wipeProgress resets the active profile's progress and toasts", () => {
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setHave("item-a", 5);

    const { result } = renderHook(() => useBackupRestore());
    act(() => {
      result.current.wipeProgress();
    });

    expect(useProgressTrackerStore.getState().progressByProfile[profileId]?.have).toEqual({});
    expect(useToastStore.getState().toast?.message).toBe("Progress wiped");
  });
});
