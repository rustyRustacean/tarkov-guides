import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { CustomItemDialog } from "./CustomItemDialog";

import type { RawItem, RawTarkovApiResponseData } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();

function makeItem(overrides: Partial<RawItem> = {}): RawItem {
  return {
    id: "item-a",
    name: "Bitcoin",
    shortName: "BTC",
    iconLink: null,
    wikiLink: null,
    basePrice: 100,
    width: 1,
    height: 1,
    avg24hPrice: null,
    lastLowPrice: null,
    changeLast48hPercent: null,
    types: [],
    sellFor: [],
    buyFor: [],
    ...overrides,
  };
}

function makeRawData(overrides: Partial<RawTarkovApiResponseData> = {}): RawTarkovApiResponseData {
  return {
    tasks: [],
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

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
  useProgressTrackerStore
    .getState()
    .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
});

describe("CustomItemDialog", () => {
  it("searches the live item catalog and shows matches", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ items: [makeItem({ id: "item-a", name: "Bitcoin", shortName: "BTC" })] }),
    );
    renderWithQueryClient(<CustomItemDialog open={true} onOpenChange={vi.fn()} />);

    await user.type(screen.getByLabelText("Search items"), "bit");
    await waitFor(() => {
      expect(screen.getByText("Bitcoin")).toBeInTheDocument();
    });
  });

  it("selecting a result then adding calls addCustomItem with the real item id", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ items: [makeItem({ id: "item-a", name: "Bitcoin", shortName: "BTC" })] }),
    );
    const onOpenChange = vi.fn();
    renderWithQueryClient(<CustomItemDialog open={true} onOpenChange={onOpenChange} />);

    await user.type(screen.getByLabelText("Search items"), "bit");
    await waitFor(() => {
      expect(screen.getByText("Bitcoin")).toBeInTheDocument();
    });
    await user.click(screen.getByText("Bitcoin"));
    expect(screen.getByText(/Selected · BTC/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add Item" }));

    const profileId = useProgressTrackerStore.getState().activeProfileId;
    expect(profileId).not.toBeNull();
    const customItems =
      profileId !== null
        ? useProgressTrackerStore.getState().progressByProfile[profileId]?.customItems
        : undefined;
    expect(customItems).toEqual([{ id: "item-a", name: "Bitcoin", iconLink: null, need: 1 }]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Add Item is disabled until an item is selected", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<CustomItemDialog open={true} onOpenChange={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Add Item" })).toBeDisabled();
    await user.type(screen.getByLabelText("Search items"), "anything");
    expect(screen.getByRole("button", { name: "Add Item" })).toBeDisabled();
  });
});
