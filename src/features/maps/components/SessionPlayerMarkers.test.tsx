import { waitFor } from "@testing-library/react";
import { MapContainer } from "react-leaflet";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { SessionPlayerMarkers } from "./SessionPlayerMarkers";

import type { SessionPlayerMarker } from "../session/use-session-positions";
import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";
import type { ReactElement } from "react";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const players = vi.hoisted(() => ({ current: [] as SessionPlayerMarker[] }));

vi.mock("../session/use-session-positions", () => ({
  useSessionPlayerPositions: () => players.current,
}));

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

/** `nameId` is the join key between a raid's log line and a map tab; the lone task is required scaffolding (see `PlayerMarker.render.test.tsx`). */
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

function player(id: string, map: string | null, color = "#3b82f6"): SessionPlayerMarker {
  return {
    id,
    name: `Player ${id}`,
    color,
    position: { x: 10, z: 20, yaw: 0, at: 1, map },
  };
}

function renderInsideMap(ui: ReactElement) {
  return renderWithQueryClient(
    <MapContainer center={[0, 0]} zoom={1} className="h-40 w-40">
      {ui}
    </MapContainer>,
  );
}

beforeEach(() => {
  players.current = [];
  vi.mocked(fetchTarkovGameData).mockResolvedValue(rawData());
});

describe("SessionPlayerMarkers", () => {
  it("draws one marker per teammate, in that teammate's own color", async () => {
    players.current = [player("p1", "RezervBase", "#22c55e"), player("p2", "RezervBase")];

    const { container } = renderInsideMap(
      <SessionPlayerMarkers normalizedName="reserve" coordinateRotation={0} />,
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".player-marker-other")).toHaveLength(2);
    });
    const fills = [...container.querySelectorAll(".player-marker-other path")].map((path) =>
      path.getAttribute("style"),
    );
    expect(fills).toEqual(["fill:#22c55e", "fill:#3b82f6"]);
    expect(container.textContent).toContain("Player p1");
  });

  it("does NOT draw a teammate who is on a different map", async () => {
    players.current = [player("p1", "RezervBase"), player("p2", "Woods")];

    const { container } = renderInsideMap(
      <SessionPlayerMarkers normalizedName="reserve" coordinateRotation={0} />,
    );

    await waitFor(() => {
      expect(container.querySelectorAll(".player-marker-other")).toHaveLength(1);
    });
    expect(container.textContent).toContain("Player p1");
    expect(container.textContent).not.toContain("Player p2");
  });

  it("draws nothing for a teammate whose position carries no map tag", async () => {
    players.current = [player("p1", null), player("p2", "RezervBase")];

    const { container } = renderInsideMap(
      <SessionPlayerMarkers normalizedName="reserve" coordinateRotation={0} />,
    );

    // The tagged teammate proves the game data really loaded - asserting "1
    // marker" would otherwise pass while still fetching.
    await waitFor(() => {
      expect(container.querySelectorAll(".player-marker-other")).toHaveLength(1);
    });
    expect(container.textContent).not.toContain("Player p1");
  });
});
