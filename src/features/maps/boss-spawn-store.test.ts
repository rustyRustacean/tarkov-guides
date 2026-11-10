import { beforeEach, describe, expect, it } from "vitest";

import { shownBossSpawnsOn, useBossSpawnStore, type ShownBossSpawns } from "./boss-spawn-store";

const RESHALA: ShownBossSpawns = {
  map: "customs",
  mode: "PVP",
  name: "Reshala",
  imagePortraitLink: null,
  tone: "hot",
  spots: [{ x: 1, z: 2, zone: "Stronghold" }],
  zonesWithoutSpots: ["Dorms"],
};

describe("boss spawn store", () => {
  beforeEach(() => {
    useBossSpawnStore.setState({ shown: null });
  });

  it("shows one boss at a time and clears", () => {
    useBossSpawnStore.getState().show(RESHALA);
    useBossSpawnStore.getState().show({ ...RESHALA, name: "Knight" });
    expect(useBossSpawnStore.getState().shown?.name).toBe("Knight");
    useBossSpawnStore.getState().clear();
    expect(useBossSpawnStore.getState().shown).toBeNull();
  });

  it("only hands the spots to a reader on the same map and mode", () => {
    useBossSpawnStore.getState().show(RESHALA);
    const state = useBossSpawnStore.getState();
    expect(shownBossSpawnsOn(state, "customs", "PVP")).toBe(RESHALA);
    expect(shownBossSpawnsOn(state, "woods", "PVP")).toBeNull();
    expect(shownBossSpawnsOn(state, "customs", "PVE")).toBeNull();
  });
});
