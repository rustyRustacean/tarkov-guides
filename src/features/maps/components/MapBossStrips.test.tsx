import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { useItemDetailStore } from "@/shared/ui/item-detail/item-detail-store";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { MapBossStrips } from "./MapBossStrips";

import type {
  RawItem,
  RawMap,
  RawMapBoss,
  RawMob,
  RawTarkovApiResponseData,
  RawTask,
} from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

function boss(name: string, spawnChance: number, mobId = `mob-${name}`): RawMapBoss {
  return {
    mobId,
    name,
    normalizedName: name.toLowerCase().replace(/\s+/g, "-"),
    imagePortraitLink: null,
    spawnChance,
  };
}

function makeItem(id: string, name: string, types: readonly string[] = []): RawItem {
  return {
    id,
    name,
    shortName: name,
    iconLink: null,
    wikiLink: null,
    basePrice: 1000,
    avg24hPrice: null,
    lastLowPrice: null,
    changeLast48hPercent: null,
    width: 1,
    height: 1,
    types,
    sellFor: [],
    buyFor: [],
  };
}

/** Kaban, trimmed to a few real-shaped rows: two primaries (one with loaded ammo), glasses, and one loot item per tier. */
const KABAN: RawMob = {
  id: "bossBoar",
  name: "Kaban",
  normalizedName: "kaban",
  imagePortraitLink: null,
  health: 1300,
  gearSamples: 15,
  gear: [
    { slot: "FirstPrimaryWeapon", itemId: "pkp", chance: 0.8, ammoItemIds: ["lps"] },
    { slot: "FirstPrimaryWeapon", itemId: "pkm", chance: 0.2 },
    { slot: "Eyewear", itemId: "raybench", chance: 0.4 },
  ],
  loot: [
    { itemId: "afak", chance: 1 },
    { itemId: "labs-card", chance: 0.061 },
    { itemId: "rusted-key", chance: 0.0023 },
  ],
};

const KABAN_ITEMS: readonly RawItem[] = [
  makeItem("pkp", "Kalashnikov PKP"),
  makeItem("pkm", "Kalashnikov PKM"),
  makeItem("lps", "LPS gzh", ["ammo"]),
  makeItem("raybench", "RayBench Aviator glasses"),
  makeItem("afak", "AFAK first aid kit", ["meds"]),
  makeItem("labs-card", "Labs access keycard", ["keys"]),
  makeItem("rusted-key", "Rusted bloody key", ["keys"]),
];

function makeMap(overrides: Partial<RawMap> = {}): RawMap {
  return {
    name: "Reserve",
    normalizedName: "reserve",
    nameId: null,
    raidDuration: 45,
    players: "8-12",
    bosses: [],
    ...overrides,
  };
}

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
    mobs: [],
    ...overrides,
  };
}

describe("MapBossStrips", () => {
  afterEach(() => {
    useItemDetailStore.getState().close();
  });

  it("renders the merged boss pills once data loads", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({
        maps: [
          makeMap({
            bosses: [boss("Gluhar", 0.3), boss("Cultist Priest", 0.2)],
          }),
        ],
      }),
    );
    renderWithQueryClient(<MapBossStrips normalizedName="reserve" />);

    expect(await screen.findByText("Gluhar")).toBeInTheDocument();
    expect(screen.getByText("Cultists")).toBeInTheDocument();
  });

  it("renders nothing for an unknown map (no bosses to show)", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const { container } = renderWithQueryClient(<MapBossStrips normalizedName="not-a-real-map" />);
    await vi.waitFor(() => {
      expect(fetchTarkovGameData).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when a map has no bosses", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ maps: [makeMap({ raidDuration: null, players: null, bosses: [] })] }),
    );
    const { container } = renderWithQueryClient(<MapBossStrips normalizedName="reserve" />);

    await vi.waitFor(() => {
      expect(fetchTarkovGameData).toHaveBeenCalled();
    });
    expect(container).toBeEmptyDOMElement();
  });

  describe("gear and loot card", () => {
    function mockKabanData() {
      vi.mocked(fetchTarkovGameData).mockResolvedValue(
        makeRawData({
          items: KABAN_ITEMS,
          maps: [
            makeMap({
              name: "Streets of Tarkov",
              normalizedName: "streets-of-tarkov",
              bosses: [boss("Kaban", 0.6, "bossBoar"), boss("Kollontay", 0.4, "bossKolontay")],
            }),
          ],
          mobs: [KABAN],
        }),
      );
    }

    async function openKaban() {
      mockKabanData();
      renderWithQueryClient(<MapBossStrips normalizedName="streets-of-tarkov" />);
      const pill = await screen.findByRole("button", { name: /Kaban/ });
      await userEvent.click(pill);
      return { pill, dialog: await screen.findByRole("dialog", { name: "Kaban" }) };
    }

    it("opens from a pill with this map's spawn chance, HP, and gear by slot", async () => {
      const { dialog } = await openKaban();
      const card = within(dialog);

      expect(card.getByText(/spawn chance/)).toHaveTextContent("60% spawn chance");
      expect(dialog).toHaveTextContent("on Streets of Tarkov");
      expect(dialog).toHaveTextContent("1,300 HP");
      expect(dialog).toHaveTextContent("15 recorded spawns");

      expect(card.getByRole("heading", { name: "Primary" })).toBeInTheDocument();
      expect(card.getByRole("heading", { name: "Eyewear" })).toBeInTheDocument();
      expect(
        card.getByRole("button", { name: /^Kalashnikov PKP, 80% of spawns/ }),
      ).toHaveTextContent("Loaded: LPS gzh");
      expect(
        card.getByRole("button", { name: /^RayBench Aviator glasses, 40%/ }),
      ).toBeInTheDocument();
    });

    it("shows common and uncommon loot, keeps rare collapsed until asked", async () => {
      const { dialog } = await openKaban();
      const card = within(dialog);

      expect(card.getByRole("button", { name: /^AFAK first aid kit, 100%/ })).toBeInTheDocument();
      expect(card.getByRole("button", { name: /^Labs access keycard, 6.1%/ })).toBeInTheDocument();
      expect(card.queryByText("Rusted bloody key")).not.toBeInTheDocument();

      const toggle = card.getByRole("button", { name: "Show 1 rare item" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-expanded", "true");
      expect(card.getByRole("button", { name: /^Rusted bloody key, 0.23%/ })).toBeInTheDocument();
    });

    it("searching reaches rare loot without expanding it first", async () => {
      const { dialog } = await openKaban();
      const card = within(dialog);

      await userEvent.type(card.getByRole("searchbox", { name: "Search loot" }), "rusted");

      expect(card.getByRole("button", { name: /^Rusted bloody key, 0.23%/ })).toBeInTheDocument();
      expect(card.queryByText("AFAK first aid kit")).not.toBeInTheDocument();
      expect(card.getByText("1 of 3 items")).toBeInTheDocument();
    });

    it("filters loot by category", async () => {
      const { dialog } = await openKaban();
      const card = within(dialog);

      await userEvent.click(card.getByRole("radio", { name: "Meds" }));
      expect(card.getByText("AFAK first aid kit")).toBeInTheDocument();
      expect(card.queryByText("Labs access keycard")).not.toBeInTheDocument();
    });

    it("opens the app-wide item detail popup from a loot row", async () => {
      const { dialog } = await openKaban();
      await userEvent.click(within(dialog).getByRole("button", { name: /^AFAK first aid kit/ }));
      expect(useItemDetailStore.getState().current).toEqual({ type: "item", id: "afak" });
    });

    it("closes on Escape and hands focus back to the pill that opened it", async () => {
      const { pill } = await openKaban();
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(pill).toHaveFocus();
    });

    it("says so when a boss has no gear or loot data", async () => {
      mockKabanData();
      renderWithQueryClient(<MapBossStrips normalizedName="streets-of-tarkov" />);
      await userEvent.click(await screen.findByRole("button", { name: /Kollontay/ }));
      const dialog = await screen.findByRole("dialog", { name: "Kollontay" });
      expect(dialog).toHaveTextContent("tarkov.dev has no gear or loot data for this enemy yet.");
    });
  });
});
