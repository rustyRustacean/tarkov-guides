import { waitFor } from "@testing-library/react";
import { MapContainer } from "react-leaflet";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { PlayerMarker } from "./PlayerMarker";

import type { CompanionPosition } from "@/features/companion/companion-config";
import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";
import type { ReactElement } from "react";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const companionPosition = vi.hoisted(() => ({ current: null as CompanionPosition | null }));

vi.mock("@/features/companion/use-companion", () => ({
  useCompanionPosition: () => companionPosition.current,
}));

const initialProgressState = useProgressTrackerStore.getInitialState();

function makeTask(): RawTask {
  return {
    id: "task-1",
    name: "Task",
    kappaRequired: false,
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
    objectives: [],
    failConditions: [],
    finishRewards: null,
    startRewards: null,
    failureOutcome: null,
  };
}

/**
 * Only `nameId` matters here - it's the join key between a raid's log line and
 * a map tab. The lone task is required scaffolding: `useTarkovGameData` treats
 * an empty tasks-and-items payload as a failed refresh and throws, so a fixture
 * without one never resolves.
 */
function rawData(): RawTarkovApiResponseData {
  return {
    tasks: [makeTask()],
    tasksPve: [],
    hideoutStations: [],
    items: [],
    itemsPve: [],
    maps: [
      {
        name: "Reserve",
        normalizedName: "reserve",
        nameId: "RezervBase",
        raidDuration: null,
        players: null,
        bosses: [],
      },
      {
        name: "Woods",
        normalizedName: "woods",
        nameId: "Woods",
        raidDuration: null,
        players: null,
        bosses: [],
      },
    ],
    traders: [],
    barters: [],
    crafts: [],
  };
}

/** The Leaflet `Marker` needs a real `MapContainer` ancestor to mount. */
function renderInsideMap(ui: ReactElement) {
  return renderWithQueryClient(
    <MapContainer center={[0, 0]} zoom={1} className="h-40 w-40">
      {ui}
    </MapContainer>,
  );
}

beforeEach(() => {
  useProgressTrackerStore.setState(initialProgressState, true);
  companionPosition.current = null;
  vi.mocked(fetchTarkovGameData).mockResolvedValue(rawData());
});

describe("PlayerMarker map gating", () => {
  it("draws the position on the map it was captured on", async () => {
    companionPosition.current = { x: 10, z: 20, yaw: 0, at: 1, map: "RezervBase" };
    const { container } = renderInsideMap(
      <PlayerMarker normalizedName="reserve" coordinateRotation={0} />,
    );
    await waitFor(() => {
      expect(container.querySelectorAll(".player-marker")).toHaveLength(1);
    });
  });

  // The two below render a matching marker alongside the one under test, so a
  // count of exactly 1 proves the game data really did load - an assertion of
  // "0 markers" on its own would pass just as happily while still fetching.
  it("does NOT draw a Reserve position while viewing Woods", async () => {
    companionPosition.current = { x: 10, z: 20, yaw: 0, at: 1, map: "RezervBase" };
    const { container } = renderInsideMap(
      <>
        <PlayerMarker normalizedName="reserve" coordinateRotation={0} />
        <PlayerMarker normalizedName="woods" coordinateRotation={0} />
      </>,
    );
    await waitFor(() => {
      expect(container.querySelectorAll(".player-marker")).toHaveLength(1);
    });
  });

  it("draws nothing when the capture map is unknown, rather than guessing", async () => {
    companionPosition.current = { x: 10, z: 20, yaw: 0, at: 1, map: null };
    const { container, rerender } = renderInsideMap(
      <PlayerMarker normalizedName="reserve" coordinateRotation={0} />,
    );
    await waitFor(() => {
      expect(vi.mocked(fetchTarkovGameData)).toHaveBeenCalled();
    });
    expect(container.querySelectorAll(".player-marker")).toHaveLength(0);

    // Same map, same coordinates - only the capture tag differs, so this
    // pins the blank result on the missing tag rather than on unloaded data.
    companionPosition.current = { x: 10, z: 20, yaw: 0, at: 2, map: "RezervBase" };
    rerender(
      <MapContainer center={[0, 0]} zoom={1} className="h-40 w-40">
        <PlayerMarker normalizedName="reserve" coordinateRotation={0} />
      </MapContainer>,
    );
    await waitFor(() => {
      expect(container.querySelectorAll(".player-marker")).toHaveLength(1);
    });
  });
});
