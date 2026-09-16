import { waitFor } from "@testing-library/react";
import L from "leaflet";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useMapsStore } from "../store";

import { MapViewer } from "./MapViewer";

import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";

// TaskMarkersLayer (rendered inside MapViewer) calls useTarkovGameData(),
// which needs a real QueryClientProvider ancestor plus a mocked fetch; see
// src/test/render-with-providers.tsx's doc comment.
vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

// This file exercises MapViewer's core rendering (imagery, custom variants,
// resize handling), not collaborative-session behavior: both session hooks
// (used by the nested AnnotationCanvas and this file's own SessionViewSync)
// require a real RoomProvider ancestor otherwise, which nothing here sets up.
vi.mock("../session/use-session-annotation-layer", () => ({
  useSessionAnnotationLayer: () => null,
}));
vi.mock("../session/use-session-positions", () => ({
  useSessionPlayerPositions: () => [],
}));
vi.mock("../session/use-maps-session", () => ({
  useMapsSession: () => ({
    active: false,
    selfId: null,
    isHost: false,
    isController: false,
    hostId: null,
    controllerId: null,
    participants: [],
    view: null,
    setView: () => undefined,
    requestControl: () => undefined,
    releaseControl: () => undefined,
    incomingControlRequest: null,
    respondToControlRequest: () => undefined,
  }),
}));

const initialMapsState = useMapsStore.getInitialState();

beforeEach(() => {
  useMapsStore.setState(initialMapsState, true);
});

function makeTask(overrides: Partial<RawTask> = {}): RawTask {
  return {
    id: "task-1",
    name: "Task",
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
    objectives: [],
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

describe("MapViewer", () => {
  it("renders a known map without crashing", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const { container } = renderWithQueryClient(<MapViewer normalizedName="reserve" />);
    expect(container.querySelector(".leaflet-container")).toBeInTheDocument();
  });

  it("renders a custom variant's uploaded image once selected", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    useMapsStore
      .getState()
      .addCustomMap("reserve", { id: "custom-1", label: "Mine", custom: true });
    useMapsStore.getState().setCustomMapImage("custom-1", "data:image/png;base64,AAAA");
    useMapsStore.getState().setMapVariant("reserve", "custom-1");

    const { container } = renderWithQueryClient(<MapViewer normalizedName="reserve" />);

    await waitFor(() => {
      expect(container.querySelector('img[src^="data:image/png;base64,AAAA"]')).toBeInTheDocument();
    });
  });

  it("shows a message for an unknown map id instead of crashing", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const { getByText } = renderWithQueryClient(<MapViewer normalizedName="not-a-real-map" />);
    expect(getByText(/unknown map/i)).toBeInTheDocument();
  });

  it("calls the Leaflet map's invalidateSize when its own container resizes", () => {
    let resizeCallback: (() => void) | undefined;
    const originalResizeObserver = globalThis.ResizeObserver;
    class CapturingResizeObserver {
      constructor(callback: () => void) {
        resizeCallback = callback;
      }
      observe = () => undefined;
      unobserve = () => undefined;
      disconnect = () => undefined;
    }
    globalThis.ResizeObserver = CapturingResizeObserver as unknown as typeof ResizeObserver;

    const invalidateSize = vi
      .spyOn(L.Map.prototype, "invalidateSize")
      .mockImplementation(() => undefined as unknown as L.Map);

    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<MapViewer normalizedName="reserve" />);

    expect(resizeCallback).toBeDefined();
    resizeCallback?.();

    expect(invalidateSize).toHaveBeenCalled();

    globalThis.ResizeObserver = originalResizeObserver;
    invalidateSize.mockRestore();
  });
});
