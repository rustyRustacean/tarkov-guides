import { beforeEach, describe, expect, it } from "vitest";

import { useProgressTrackerStore } from "./store";
import { emptyProfileProgress, hideoutBuiltKey } from "./types";

const initialState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
});

function createProfile(name = "PMC") {
  const { createProfile } = useProgressTrackerStore.getState();
  return createProfile({ name, mode: "PVP", faction: "BEAR", face: null });
}

describe("profile actions", () => {
  it("createProfile adds the profile, seeds empty progress, and activates it", () => {
    const id = createProfile("Nikita");
    const state = useProgressTrackerStore.getState();
    expect(state.profiles).toHaveLength(1);
    expect(state.profiles[0]).toMatchObject({ id, name: "Nikita" });
    expect(state.activeProfileId).toBe(id);
    expect(state.progressByProfile[`${id}:PVP`]).toEqual(emptyProfileProgress("BEAR"));
  });

  it("switchProfile is a no-op for an unknown id", () => {
    const id = createProfile();
    useProgressTrackerStore.getState().switchProfile("does-not-exist");
    expect(useProgressTrackerStore.getState().activeProfileId).toBe(id);
  });

  it("updateProfile merges name/mode/face but the update type has no faction field", () => {
    const id = createProfile();
    useProgressTrackerStore.getState().updateProfile(id, { name: "Renamed" });
    const profile = useProgressTrackerStore.getState().profiles.find((p) => p.id === id);
    expect(profile).toMatchObject({ name: "Renamed" });
  });

  it("deleteProfile removes the profile and its progress bucket", () => {
    const id = createProfile();
    useProgressTrackerStore.getState().deleteProfile(id);
    const state = useProgressTrackerStore.getState();
    expect(state.profiles).toHaveLength(0);
    expect(state.progressByProfile[`${id}:PVP`]).toBeUndefined();
  });

  it("deleting the active profile activates the first remaining one, or null if none remain", () => {
    const a = createProfile("A");
    const b = createProfile("B");
    useProgressTrackerStore.getState().switchProfile(a);
    useProgressTrackerStore.getState().deleteProfile(a);
    expect(useProgressTrackerStore.getState().activeProfileId).toBe(b);

    useProgressTrackerStore.getState().deleteProfile(b);
    expect(useProgressTrackerStore.getState().activeProfileId).toBeNull();
  });

  it("setAutoStartNext sets the global (not per-profile) pref", () => {
    useProgressTrackerStore.getState().setAutoStartNext(false);
    expect(useProgressTrackerStore.getState().autoStartNext).toBe(false);
  });
});

describe("progress setters - no-op with no active profile", () => {
  it("every progress setter no-ops when activeProfileId is null", () => {
    const store = useProgressTrackerStore.getState();
    store.setHave("item-a", 5);
    store.setPending("item-a", 2);
    store.setPlayerLevel(10);
    store.togglePinnedItem("item-a");
    expect(useProgressTrackerStore.getState().progressByProfile).toEqual({});
  });
});

describe("progress setters - with an active profile", () => {
  let id: string;
  beforeEach(() => {
    id = createProfile();
  });

  it("setTaskStatuses merge-patches rather than replacing the whole record", () => {
    const { setTaskStatuses } = useProgressTrackerStore.getState();
    setTaskStatuses({ "task-1": { status: "inprog" } });
    setTaskStatuses({ "task-2": { status: "done" } });
    const progress = useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`];
    expect(progress?.taskStatus).toEqual({
      "task-1": { status: "inprog" },
      "task-2": { status: "done" },
    });
  });

  it("replaceHaveAndPending fully replaces both records", () => {
    const { setHave, replaceHaveAndPending } = useProgressTrackerStore.getState();
    setHave("stale-item", 9);
    replaceHaveAndPending({ "item-a": 3 }, { "item-b": 1 });
    const progress = useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`];
    expect(progress?.have).toEqual({ "item-a": 3 });
    expect(progress?.pending).toEqual({ "item-b": 1 });
  });

  it("setHave/setPending set a single item's count directly", () => {
    const { setHave, setPending } = useProgressTrackerStore.getState();
    setHave("item-a", 4);
    setPending("item-a", 2);
    const progress = useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`];
    expect(progress?.have).toEqual({ "item-a": 4 });
    expect(progress?.pending).toEqual({ "item-a": 2 });
  });

  it("setHideoutBuilt sets true entries and deletes undefined entries", () => {
    const { setHideoutBuilt } = useProgressTrackerStore.getState();
    const key1 = hideoutBuiltKey("workbench", 1);
    const key2 = hideoutBuiltKey("workbench", 2);
    setHideoutBuilt({ [key1]: true, [key2]: true });
    let progress = useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`];
    expect(progress?.hideoutBuilt).toEqual({ [key1]: true, [key2]: true });

    setHideoutBuilt({ [key1]: undefined });
    progress = useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`];
    expect(progress?.hideoutBuilt).toEqual({ [key2]: true });
  });

  it("setHideoutGoal sets/clears the per-profile goal", () => {
    const { setHideoutGoal } = useProgressTrackerStore.getState();
    setHideoutGoal({ stationNormalizedName: "workbench", level: 2 });
    expect(useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`]?.hideoutGoal).toEqual({
      stationNormalizedName: "workbench",
      level: 2,
    });
    setHideoutGoal(null);
    expect(
      useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`]?.hideoutGoal,
    ).toBeNull();
  });

  it("setKappaGot toggles an item's got state via true/omit, not a boolean field", () => {
    const { setKappaGot } = useProgressTrackerStore.getState();
    setKappaGot("item-a", true);
    expect(useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`]?.kappaGot).toEqual({
      "item-a": true,
    });
    setKappaGot("item-a", false);
    expect(useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`]?.kappaGot).toEqual({});
  });

  it("setCustomItems replaces the whole list", () => {
    const { setCustomItems } = useProgressTrackerStore.getState();
    setCustomItems([{ id: "c1", name: "Custom", iconLink: null, need: 1 }]);
    expect(
      useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`]?.customItems,
    ).toHaveLength(1);
  });

  it("togglePinnedItem/togglePinnedTask add then remove, newest first", () => {
    const { togglePinnedItem, togglePinnedTask } = useProgressTrackerStore.getState();
    togglePinnedItem("item-a");
    togglePinnedItem("item-b");
    expect(
      useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`]?.pinnedItemIds,
    ).toEqual(["item-b", "item-a"]);
    togglePinnedItem("item-a");
    expect(
      useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`]?.pinnedItemIds,
    ).toEqual(["item-b"]);

    togglePinnedTask("task-a");
    expect(
      useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`]?.pinnedTaskIds,
    ).toEqual(["task-a"]);
  });

  it("setPlayerLevel/setPrestigeLevel/setTraderLevel/setTraderReputation set per-profile character stats", () => {
    const { setPlayerLevel, setPrestigeLevel, setTraderLevel, setTraderReputation } =
      useProgressTrackerStore.getState();
    setPlayerLevel(15);
    setPrestigeLevel(2);
    setTraderLevel("prapor", 3);
    setTraderReputation("fence", -2);
    const progress = useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`];
    expect(progress?.playerLevel).toBe(15);
    expect(progress?.prestigeLevel).toBe(2);
    expect(progress?.traderLevels).toEqual({ prapor: 3 });
    expect(progress?.traderReputation).toEqual({ fence: -2 });
  });

  it("wipeActiveProgress resets to a fresh empty bucket via one canonical function", () => {
    const { setHave, setPlayerLevel, wipeActiveProgress } = useProgressTrackerStore.getState();
    setHave("item-a", 5);
    setPlayerLevel(20);
    wipeActiveProgress();
    expect(useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`]).toEqual(
      emptyProfileProgress("BEAR"),
    );
  });

  it("replaceActiveProgress fully replaces the bucket (used by undo restore/import)", () => {
    const { setHave, replaceActiveProgress } = useProgressTrackerStore.getState();
    setHave("stale", 1);
    const restored = { ...emptyProfileProgress("BEAR"), have: { "item-a": 7 } };
    replaceActiveProgress(restored);
    expect(useProgressTrackerStore.getState().progressByProfile[`${id}:PVP`]).toEqual(restored);
  });
});

describe("hydrate", () => {
  it("loads a full snapshot's worth of state at once", () => {
    const profile = {
      id: "p1",
      name: "PMC",
      face: null,
    };
    useProgressTrackerStore.getState().hydrate({
      schemaVersion: 1,
      exportedAt: "2026-07-10T00:00:00.000Z",
      profiles: [profile],
      activeProfileId: "p1",
      activeMode: "PVP",
      progressByProfile: { "p1:PVP": emptyProfileProgress("BEAR") },
      autoStartNext: false,
    });
    const state = useProgressTrackerStore.getState();
    expect(state.profiles).toEqual([profile]);
    expect(state.activeProfileId).toBe("p1");
    expect(state.autoStartNext).toBe(false);
  });
});
