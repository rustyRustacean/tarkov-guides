import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { QUEST_SIGNATURE_MIN } from "../lib/map-valuables";
import { useMapsStore } from "../store";

import { MapValuablesPanel } from "./MapValuablesPanel";

import type { RawTarkovApiResponseData, RawItem, RawTask } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialProgressState = useProgressTrackerStore.getInitialState();
const initialMapsState = useMapsStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialProgressState, true);
  useMapsStore.setState(initialMapsState, true);
});

function mapRef(normalizedName: string): { name: string; normalizedName: string } {
  return { name: normalizedName, normalizedName };
}

function makeTask(overrides: Partial<RawTask> = {}): RawTask {
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
    ...overrides,
  };
}

function makeItem(overrides: Partial<RawItem> = {}): RawItem {
  return {
    id: "item-a",
    name: "Item A",
    shortName: "A",
    iconLink: null,
    wikiLink: null,
    basePrice: 100,
    width: 1,
    height: 1,
    avg24hPrice: null,
    lastLowPrice: null,
    changeLast48hPercent: null,
    types: ["barter"],
    sellFor: [],
    buyFor: [],
    ...overrides,
  };
}

function makeRawData(overrides: Partial<RawTarkovApiResponseData> = {}): RawTarkovApiResponseData {
  return {
    tasks: [makeTask()],
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

function activateProfile(): string {
  return useProgressTrackerStore
    .getState()
    .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
}

describe("MapValuablesPanel", () => {
  it("shows empty states when nothing qualifies", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<MapValuablesPanel normalizedName="reserve" />);
    expect(await screen.findByText("No quest-signature items on this map.")).toBeInTheDocument();
    expect(
      screen.getByText("No items at or above this threshold on the flea market."),
    ).toBeInTheDocument();
  });

  it("shows a Map Signature item referenced by >= QUEST_SIGNATURE_MIN of this map's own tasks", async () => {
    // `RawTask` has no `itemRequirements` field directly - it's derived by
    // `normalizeTask` from `objectives`, so each task fixture attaches a
    // real `find` objective instead.
    const tasks = Array.from({ length: QUEST_SIGNATURE_MIN }, (_, i) =>
      makeTask({
        id: `t${String(i)}`,
        map: mapRef("reserve"),
        objectives: [
          {
            id: `obj-${String(i)}`,
            type: "find",
            description: "Find it",
            optional: false,
            maps: [],
            item: { id: "sig-item", name: "Signature Item", shortName: "Sig", iconLink: null },
            count: 1,
            foundInRaid: false,
          },
        ],
      }),
    );
    const item = makeItem({ id: "sig-item", name: "Signature Item", avg24hPrice: 10_000 });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks, items: [item] }));

    renderWithQueryClient(<MapValuablesPanel normalizedName="reserve" />);

    expect(await screen.findByText("Signature Item")).toBeInTheDocument();
    expect(screen.getByText(`×${String(QUEST_SIGNATURE_MIN)}`)).toBeInTheDocument();
  });

  it("shows a Top Dollar item at or above the current threshold", async () => {
    const item = makeItem({ id: "top-item", name: "Top Item", avg24hPrice: 50_000 });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ items: [item] }));

    renderWithQueryClient(<MapValuablesPanel normalizedName="reserve" />);

    expect(await screen.findByText("Top Item")).toBeInTheDocument();
    expect(screen.getByText("50,000₽ avg")).toBeInTheDocument();
  });

  it("raising the threshold above an item's price removes it from Top Dollar", async () => {
    const item = makeItem({ id: "top-item", name: "Top Item", avg24hPrice: 50_000 });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ items: [item] }));

    renderWithQueryClient(<MapValuablesPanel normalizedName="reserve" />);
    await screen.findByText("Top Item");

    fireEvent.change(screen.getByRole("spinbutton", { name: /Minimum 24h average price/ }), {
      target: { value: "60" },
    });

    expect(useMapsStore.getState().topDollarThresholdRub).toBe(60_000);
    expect(screen.queryByText("Top Item")).not.toBeInTheDocument();
    expect(
      screen.getByText("No items at or above this threshold on the flea market."),
    ).toBeInTheDocument();
  });

  it("double-clicking a row toggles the item's pinned state", async () => {
    const profileId = activateProfile();
    const item = makeItem({ id: "top-item", name: "Top Item", avg24hPrice: 50_000 });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ items: [item] }));

    renderWithQueryClient(<MapValuablesPanel normalizedName="reserve" />);
    const row = await screen.findByText("Top Item");
    fireEvent.doubleClick(row);

    expect(useProgressTrackerStore.getState().progressByProfile[profileId]?.pinnedItemIds).toEqual([
      "top-item",
    ]);
  });

  it("excludes a non-barter item, quest tool, and dogtag even above the threshold", async () => {
    const ammo = makeItem({ id: "ammo-1", name: "Ammo", types: ["ammo"], avg24hPrice: 100_000 });
    const questTool = makeItem({
      id: "qt-1",
      name: "MS2000 Marker",
      avg24hPrice: 100_000,
    });
    const dogtag = makeItem({
      id: "dt-1",
      name: "Dogtag Killa",
      avg24hPrice: 100_000,
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ items: [ammo, questTool, dogtag] }),
    );

    renderWithQueryClient(<MapValuablesPanel normalizedName="reserve" />);

    expect(
      await screen.findByText("No items at or above this threshold on the flea market."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Ammo")).not.toBeInTheDocument();
    expect(screen.queryByText("MS2000 Marker")).not.toBeInTheDocument();
    expect(screen.queryByText("Dogtag Killa")).not.toBeInTheDocument();
  });
});
