import { beforeEach, describe, expect, it } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { useMapsStore } from "./store";
import { emptyMapProfileState } from "./types";

const initialMapsState = useMapsStore.getInitialState();
const initialProgressTrackerState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useMapsStore.setState(initialMapsState, true);
  useProgressTrackerStore.setState(initialProgressTrackerState, true);
});

function activateAProfile(): string {
  return useProgressTrackerStore
    .getState()
    .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
}

describe("global (not per-profile) actions", () => {
  it("setCurrentMap updates currentMap", () => {
    useMapsStore.getState().setCurrentMap("customs");
    expect(useMapsStore.getState().currentMap).toBe("customs");
  });

  it("setMapVariant sets the variant for that map only", () => {
    useMapsStore.getState().setMapVariant("reserve", "2d");
    useMapsStore.getState().setMapVariant("customs", "3d");
    expect(useMapsStore.getState().mapVariants).toEqual({ reserve: "2d", customs: "3d" });
  });

  it("addCustomMap appends to that map's list without touching others", () => {
    useMapsStore.getState().addCustomMap("reserve", { id: "c1", label: "My custom", custom: true });
    useMapsStore.getState().addCustomMap("reserve", { id: "c2", label: "Second", custom: true });
    expect(useMapsStore.getState().customMaps.reserve).toHaveLength(2);
  });

  it("removeCustomMap removes only the matching entry", () => {
    useMapsStore.getState().addCustomMap("reserve", { id: "c1", label: "Keep", custom: true });
    useMapsStore.getState().addCustomMap("reserve", { id: "c2", label: "Remove", custom: true });
    useMapsStore.getState().removeCustomMap("reserve", "c2");
    expect(useMapsStore.getState().customMaps.reserve).toEqual([
      { id: "c1", label: "Keep", custom: true },
    ]);
  });

  it("removeCustomMap also clears the matching customMapImageCache entry", () => {
    useMapsStore.getState().addCustomMap("reserve", { id: "c1", label: "Keep", custom: true });
    useMapsStore.getState().setCustomMapImage("c1", "data:image/png;base64,AAAA");
    useMapsStore.getState().removeCustomMap("reserve", "c1");
    expect(useMapsStore.getState().customMapImageCache).toEqual({});
  });

  it("setCustomMapImage adds a resolved image without touching other cache entries", () => {
    useMapsStore.getState().setCustomMapImage("c1", "data:image/png;base64,AAAA");
    useMapsStore.getState().setCustomMapImage("c2", "data:image/png;base64,BBBB");
    expect(useMapsStore.getState().customMapImageCache).toEqual({
      c1: "data:image/png;base64,AAAA",
      c2: "data:image/png;base64,BBBB",
    });
  });

  it("show-task toggles are independent booleans", () => {
    useMapsStore.getState().setShowTaskLinks(true);
    expect(useMapsStore.getState()).toMatchObject({
      showTaskMarkers: true,
      showTaskLinks: true,
      showTaskNames: false,
    });
  });

  it("setSidebarPane defaults to items and updates on call", () => {
    expect(useMapsStore.getState().sidebarPane).toBe("items");
    useMapsStore.getState().setSidebarPane("tasks");
    expect(useMapsStore.getState().sidebarPane).toBe("tasks");
  });

  it("setTopDollarThreshold defaults to 45000 and updates on call", () => {
    expect(useMapsStore.getState().topDollarThresholdRub).toBe(45_000);
    useMapsStore.getState().setTopDollarThreshold(60_000);
    expect(useMapsStore.getState().topDollarThresholdRub).toBe(60_000);
  });

  it("setMapFullscreen defaults to false and updates on call", () => {
    expect(useMapsStore.getState().mapFullscreen).toBe(false);
    useMapsStore.getState().setMapFullscreen(true);
    expect(useMapsStore.getState().mapFullscreen).toBe(true);
  });

  it("setRightPanelCollapsed defaults to true and updates on call", () => {
    expect(useMapsStore.getState().rightPanelCollapsed).toBe(true);
    useMapsStore.getState().setRightPanelCollapsed(false);
    expect(useMapsStore.getState().rightPanelCollapsed).toBe(false);
  });

  it("setMobileSheetOpen defaults to false and updates on call", () => {
    expect(useMapsStore.getState().mobileSheetOpen).toBe(false);
    useMapsStore.getState().setMobileSheetOpen(true);
    expect(useMapsStore.getState().mobileSheetOpen).toBe(true);
  });
});

describe("per-profile actions", () => {
  it("setAnnotationLayer is a no-op with no active profile", () => {
    useMapsStore.getState().setAnnotationLayer("reserve", "overview", { strokes: [], locks: [] });
    expect(useMapsStore.getState().profileState).toEqual({});
  });

  it("setAnnotationLayer scopes to the active profile and map+variant", () => {
    const profileId = activateAProfile();
    const layer = {
      strokes: [
        { id: "s1", type: "pen" as const, color: "#fff", width: 4, points: [{ fx: 0.1, fy: 0.2 }] },
      ],
      locks: [],
    };
    useMapsStore.getState().setAnnotationLayer("reserve", "overview", layer);

    expect(useMapsStore.getState().profileState[profileId]?.annotations.reserve?.overview).toEqual(
      layer,
    );
  });

  it("annotations for different profiles don't leak into each other", () => {
    const profileA = activateAProfile();
    useMapsStore.getState().setAnnotationLayer("reserve", "overview", {
      strokes: [{ id: "a", type: "pen", color: "#fff", width: 4, points: [] }],
      locks: [],
    });

    const profileB = useProgressTrackerStore
      .getState()
      .createProfile({ name: "Second", mode: "PVE", faction: "USEC", face: null });
    useMapsStore.getState().setAnnotationLayer("reserve", "overview", {
      strokes: [{ id: "b", type: "pen", color: "#000", width: 2, points: [] }],
      locks: [],
    });

    const state = useMapsStore.getState();
    expect(state.profileState[profileA]?.annotations.reserve?.overview?.strokes[0]?.id).toBe("a");
    expect(state.profileState[profileB]?.annotations.reserve?.overview?.strokes[0]?.id).toBe("b");
  });

  it("setTaskDisplayOverride sets and clears an override", () => {
    const profileId = activateAProfile();
    useMapsStore.getState().setTaskDisplayOverride("task-1", false);
    expect(useMapsStore.getState().profileState[profileId]?.taskDisplayOverrides).toEqual({
      "task-1": false,
    });

    useMapsStore.getState().setTaskDisplayOverride("task-1", undefined);
    expect(useMapsStore.getState().profileState[profileId]?.taskDisplayOverrides).toEqual({});
  });
});

describe("hydrate", () => {
  it("replaces the whole persisted slice", () => {
    const snapshot = {
      schemaVersion: 1 as const,
      exportedAt: new Date().toISOString(),
      currentMap: "woods",
      mapVariants: { woods: "3d" },
      customMaps: {},
      profileState: { "profile-1": emptyMapProfileState() },
      topDollarThresholdRub: 60_000,
    };
    useMapsStore.getState().hydrate(snapshot);

    const state = useMapsStore.getState();
    expect(state.currentMap).toBe("woods");
    expect(state.mapVariants).toEqual({ woods: "3d" });
    expect(state.profileState["profile-1"]).toEqual(emptyMapProfileState());
    expect(state.topDollarThresholdRub).toBe(60_000);
  });
});
