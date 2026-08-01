import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useItemDetailStore } from "./item-detail-store";
import { ItemDetailDialog } from "./ItemDetailDialog";

import type { RawItem, RawTarkovApiResponseData } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

function makeRawItem(overrides: Partial<RawItem> = {}): RawItem {
  return {
    id: "ledx",
    name: "LEDX Skin Transilluminator",
    shortName: "LEDX",
    iconLink: null,
    wikiLink: "https://example.com/ledx",
    basePrice: 100_000,
    avg24hPrice: 820_000,
    lastLowPrice: 790_000,
    changeLast48hPercent: 2.5,
    width: 1,
    height: 1,
    types: ["barter"],
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
  useItemDetailStore.setState({ current: null, stack: [] });
});

describe("ItemDetailDialog", () => {
  it("renders no dialog when nothing is open", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ items: [makeRawItem()] }));
    renderWithQueryClient(<ItemDetailDialog />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the item header and its connection sections once opened", async () => {
    const ledx = makeRawItem();
    const bolts = makeRawItem({ id: "bolts", name: "Bolts", shortName: "Bolts", wikiLink: null });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({
        items: [ledx, bolts],
        barters: [
          {
            id: "barter-1",
            level: 2,
            trader: { name: "Therapist", normalizedName: "therapist" },
            requiredItems: [
              {
                item: { id: "bolts", name: "Bolts", shortName: "Bolts", iconLink: null },
                count: 3,
              },
            ],
            rewardItems: [
              {
                item: {
                  id: "ledx",
                  name: "LEDX Skin Transilluminator",
                  shortName: "LEDX",
                  iconLink: null,
                },
                count: 1,
              },
            ],
          },
        ],
        hideoutStations: [
          {
            id: "medstation",
            name: "Medstation",
            normalizedName: "medstation",
            levels: [
              {
                level: 3,
                stationLevelRequirements: [],
                itemRequirements: [
                  {
                    item: { id: "ledx", name: "LEDX", shortName: "LEDX", iconLink: null },
                    count: 1,
                  },
                ],
              },
            ],
          },
        ],
      }),
    );

    renderWithQueryClient(<ItemDetailDialog />);
    useItemDetailStore.getState().openItem("ledx");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "LEDX Skin Transilluminator" }),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Obtainable via barter")).toBeInTheDocument();
    expect(screen.getByText("Needed for hideout")).toBeInTheDocument();
    expect(screen.getByText("Medstation")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wiki page" })).toHaveAttribute(
      "href",
      "https://example.com/ledx",
    );
  });

  it("drills into a barter's input item and walks back", async () => {
    const user = userEvent.setup();
    const ledx = makeRawItem();
    const bolts = makeRawItem({ id: "bolts", name: "Bolts", shortName: "Bolts", wikiLink: null });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({
        items: [ledx, bolts],
        barters: [
          {
            id: "barter-1",
            level: 2,
            trader: { name: "Therapist", normalizedName: "therapist" },
            requiredItems: [
              {
                item: { id: "bolts", name: "Bolts", shortName: "Bolts", iconLink: null },
                count: 3,
              },
            ],
            rewardItems: [
              {
                item: {
                  id: "ledx",
                  name: "LEDX Skin Transilluminator",
                  shortName: "LEDX",
                  iconLink: null,
                },
                count: 1,
              },
            ],
          },
        ],
      }),
    );

    renderWithQueryClient(<ItemDetailDialog />);
    useItemDetailStore.getState().openItem("ledx");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "LEDX Skin Transilluminator" }),
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Bolts/ }));
    expect(useItemDetailStore.getState().current).toEqual({ type: "item", id: "bolts" });
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Bolts" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "← Back" }));
    expect(useItemDetailStore.getState().current).toEqual({ type: "item", id: "ledx" });
  });

  it("routes a task-requirement click to the store's openTask", async () => {
    const user = userEvent.setup();
    // A trader buy offer gated behind a task drives the "Unlocked by task" section.
    const ledx = makeRawItem({
      buyFor: [
        {
          priceRUB: 5000,
          currency: "RUB",
          vendor: {
            name: "Therapist",
            normalizedName: "therapist",
            minTraderLevel: 2,
            taskUnlock: { id: "task-99", name: "Health Care Privacy" },
          },
        },
      ],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ items: [ledx] }));

    renderWithQueryClient(<ItemDetailDialog />);
    useItemDetailStore.getState().openItem("ledx");

    await waitFor(() => {
      expect(screen.getByText("Unlocked by task")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "Health Care Privacy" }));
    expect(useItemDetailStore.getState().current).toEqual({ type: "task", id: "task-99" });
  });
});
