import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { BeginnerItemsGuide } from "./BeginnerItemsGuide";

import type { RawItem, RawTarkovApiResponseData } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();

function makeItem(overrides: Partial<RawItem> = {}): RawItem {
  return {
    id: "item-ledx",
    name: "LEDX Skin Transilluminator",
    shortName: "LEDX",
    iconLink: null,
    wikiLink: null,
    basePrice: 100,
    width: 1,
    height: 1,
    avg24hPrice: 250000,
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
});

describe("BeginnerItemsGuide", () => {
  it("shows a loading message before item data resolves", () => {
    vi.mocked(fetchTarkovGameData).mockReturnValue(new Promise(() => undefined));
    renderWithQueryClient(<BeginnerItemsGuide />);
    expect(screen.getByText(/Item data still loading/)).toBeInTheDocument();
  });

  it("renders a resolved beginner item under its category, with the category's rationale", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ items: [makeItem()] }));
    renderWithQueryClient(<BeginnerItemsGuide />);

    await waitFor(() => {
      expect(screen.getByText("LEDX Skin Transilluminator")).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Early trader quests" })).toBeInTheDocument();
    expect(screen.getByText(/LL1–2 tasks ask for these on repeat/)).toBeInTheDocument();
  });

  it("does not render a category with zero resolved items", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ items: [makeItem()] }));
    renderWithQueryClient(<BeginnerItemsGuide />);

    await waitFor(() => {
      expect(screen.getByText("LEDX Skin Transilluminator")).toBeInTheDocument();
    });
    expect(screen.queryByRole("heading", { name: "Hideout essentials" })).not.toBeInTheDocument();
  });

  it("pinning an item toggles it through the store, requiring an active profile to take effect", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ items: [makeItem()] }));
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const user = userEvent.setup();
    renderWithQueryClient(<BeginnerItemsGuide />);

    await waitFor(() => {
      expect(screen.getByText("LEDX Skin Transilluminator")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Pin" }));

    expect(
      useProgressTrackerStore.getState().progressByProfile[profileId]?.pinnedItemIds,
    ).toContain("item-ledx");
    expect(screen.getByRole("button", { name: "Pinned" })).toBeInTheDocument();
  });
});
