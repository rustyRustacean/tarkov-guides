import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { useBossSpawnStore } from "../boss-spawn-store";
import { useMapsStore } from "../store";

import { useClearBossSpawnSpotsOnChange } from "./use-clear-boss-spawn-spots";

function showReshala(): void {
  useBossSpawnStore.getState().show({
    map: "customs",
    mode: "PVP",
    name: "Reshala",
    imagePortraitLink: null,
    tone: "hot",
    spots: [{ x: 1, z: 2, zone: "Stronghold" }],
    zonesWithoutSpots: [],
  });
}

describe("useClearBossSpawnSpotsOnChange", () => {
  beforeEach(() => {
    useMapsStore.setState({ currentMap: "customs" });
    useProgressTrackerStore.setState({ activeMode: "PVP" });
    useBossSpawnStore.setState({ shown: null });
  });

  it("clears the spots when the map tab changes", () => {
    renderHook(() => {
      useClearBossSpawnSpotsOnChange();
    });
    showReshala();
    act(() => {
      useMapsStore.getState().setCurrentMap("woods");
    });
    expect(useBossSpawnStore.getState().shown).toBeNull();
  });

  it("clears the spots when the game mode changes", () => {
    renderHook(() => {
      useClearBossSpawnSpotsOnChange();
    });
    showReshala();
    act(() => {
      useProgressTrackerStore.getState().switchMode("PVE");
    });
    expect(useBossSpawnStore.getState().shown).toBeNull();
  });

  it("keeps the spots through unrelated store changes, and stops listening once unmounted", () => {
    const { unmount } = renderHook(() => {
      useClearBossSpawnSpotsOnChange();
    });
    showReshala();
    act(() => {
      useMapsStore.getState().setCurrentMap("customs");
      useMapsStore.setState({ showTaskNames: true });
    });
    expect(useBossSpawnStore.getState().shown?.name).toBe("Reshala");

    unmount();
    act(() => {
      useMapsStore.getState().setCurrentMap("woods");
    });
    expect(useBossSpawnStore.getState().shown?.name).toBe("Reshala");
  });
});
