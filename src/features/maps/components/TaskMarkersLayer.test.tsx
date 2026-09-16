import { waitFor } from "@testing-library/react";
import { MapContainer } from "react-leaflet";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useMapsStore } from "../store";

import { TaskMarkersLayer } from "./TaskMarkersLayer";

import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";
import type { ReactElement } from "react";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialProgressState = useProgressTrackerStore.getInitialState();
const initialMapsState = useMapsStore.getInitialState();

function makeTask(overrides: Partial<RawTask> = {}): RawTask {
  return {
    id: "task-1",
    name: "Locate the Emercom station",
    kappaRequired: false,
    hasHiddenRequirement: false,
    minPlayerLevel: 1,
    experience: 0,
    wikiLink: null,
    factionName: null,
    taskImageLink: null,
    availableDelaySecondsMin: 0,
    availableDelaySecondsMax: 0,
    restartable: false,
    lightkeeperRequired: false,
    requiredPrestige: null,
    trader: { id: "trader-1", name: "Trader", imageLink: null },
    map: null,
    taskRequirements: [],
    traderRequirements: [],
    objectives: [
      {
        id: "obj-1",
        type: "visit",
        description: "Locate the thing",
        optional: false,
        maps: [{ normalizedName: "reserve" }],
        zones: [{ id: "z1", map: { normalizedName: "reserve" }, position: { x: 10, y: 0, z: 20 } }],
      },
    ],
    failConditions: [],
    finishRewards: null,
    startRewards: null,
    failureOutcome: null,
    ...overrides,
  };
}

function makeRawData(overrides: Partial<RawTarkovApiResponseData> = {}): RawTarkovApiResponseData {
  return {
    tasks: [makeTask()],
    tasksPve: [],
    hideoutStations: [],
    items: [],
    itemsPve: [],
    maps: [],
    traders: [],
    barters: [],
    crafts: [],
    ...overrides,
  };
}

/** Leaflet layers (CircleMarker/Polyline/Tooltip) require a real MapContainer ancestor to mount. */
function renderInsideMap(ui: ReactElement) {
  return renderWithQueryClient(
    <MapContainer center={[0, 0]} zoom={1} className="h-40 w-40">
      {ui}
    </MapContainer>,
  );
}

function markerCount(container: HTMLElement): number {
  return container.querySelectorAll("path.leaflet-interactive").length;
}

beforeEach(() => {
  useProgressTrackerStore.setState(initialProgressState, true);
  useMapsStore.setState(initialMapsState, true);
});

describe("TaskMarkersLayer", () => {
  it("renders no markers with no active profile", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const { container } = renderInsideMap(<TaskMarkersLayer normalizedMapName="reserve" />);

    await waitFor(() => {
      expect(fetchTarkovGameData).toHaveBeenCalled();
    });
    expect(markerCount(container)).toBe(0);
  });

  it("renders a marker for an in-progress task with a real zone on this map", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setTaskStatuses({ "task-1": { status: "inprog" } });

    const { container } = renderInsideMap(<TaskMarkersLayer normalizedMapName="reserve" />);

    await waitFor(() => {
      expect(markerCount(container)).toBeGreaterThan(0);
    });
  });

  it("renders no markers when showTaskMarkers is turned off", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setTaskStatuses({ "task-1": { status: "inprog" } });
    useMapsStore.getState().setShowTaskMarkers(false);

    const { container } = renderInsideMap(<TaskMarkersLayer normalizedMapName="reserve" />);

    await waitFor(() => {
      expect(fetchTarkovGameData).toHaveBeenCalled();
    });
    expect(markerCount(container)).toBe(0);
  });
});
