import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { useItemDetailStore } from "@/shared/ui/item-detail/item-detail-store";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useBossSpawnStore } from "../boss-spawn-store";
import { getMapConfig, resolveVariantId, variantHasAccurateMarkers } from "../lib/map-config";
import { useMapsStore } from "../store";

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
    escorts: [],
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
  healthParts: [
    { part: "Chest", max: 355 },
    { part: "Head", max: 85 },
    { part: "LeftArm", max: 150 },
    { part: "LeftLeg", max: 150 },
    { part: "RightArm", max: 150 },
    { part: "RightLeg", max: 150 },
    { part: "Stomach", max: 260 },
  ],
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
    tasksSeason: [],
    hideoutStations: [],
    items: [],
    itemsPve: [],
    itemsSeason: [],
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
      // Both sections say their numbers are estimates, not real game odds.
      expect(dialog).toHaveTextContent(
        "Note: The percentages are rough estimates from the listed loadouts in tarkov.dev's data, not the game's real odds.",
      );
      expect(dialog).toHaveTextContent("not official drop rates");

      expect(card.getByRole("heading", { name: "Primary" })).toBeInTheDocument();
      expect(card.getByRole("heading", { name: "Eyewear" })).toBeInTheDocument();
      const pkp = card.getByRole("button", {
        name: /^Kalashnikov PKP, about 80% of sample loadouts/,
      });
      expect(pkp).toHaveTextContent("Loaded: LPS gzh");
      // Gear chances are visibly marked approximate.
      expect(pkp).toHaveTextContent("~80%");
      expect(
        card.getByRole("button", { name: /^RayBench Aviator glasses, about 40%/ }),
      ).toBeInTheDocument();
    });

    it("swaps the gear column for HP per body part via the Gear/Health tabs", async () => {
      const { dialog } = await openKaban();
      const card = within(dialog);

      const gearTab = card.getByRole("tab", { name: "Gear" });
      expect(gearTab).toHaveAttribute("aria-selected", "true");
      await userEvent.click(card.getByRole("tab", { name: "Health" }));

      // Gear is gone, the loot column beside it is untouched.
      expect(card.queryByRole("heading", { name: "Primary" })).not.toBeInTheDocument();
      expect(card.getByRole("heading", { name: "Loot" })).toBeInTheDocument();

      const table = card.getByRole("table", { name: /Max HP per body part/ });
      const rows = within(table).getAllByRole("row");
      // Header, 7 parts head to toe, total.
      expect(rows.map((row) => row.textContent)).toEqual([
        "Body partBarMax HPPMC",
        "Head8535",
        "Thorax35585",
        "Stomach26070",
        "Left arm15060",
        "Right arm15060",
        "Left leg15065",
        "Right leg15065",
        "Total1,300440",
      ]);
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

  describe("guards", () => {
    const KABAN_GUARD: RawMob = {
      id: "followerBoar",
      name: "Kaban Guard",
      normalizedName: "kaban-guard",
      imagePortraitLink: null,
      health: 725,
      healthParts: [],
      gearSamples: 15,
      gear: [{ slot: "Eyewear", itemId: "raybench", chance: 1 }],
      loot: [{ itemId: "afak", chance: 0.5 }],
    };

    function mockEscortData() {
      vi.mocked(fetchTarkovGameData).mockResolvedValue(
        makeRawData({
          items: KABAN_ITEMS,
          maps: [
            makeMap({
              name: "Streets of Tarkov",
              normalizedName: "streets-of-tarkov",
              bosses: [
                {
                  ...boss("Kaban", 0.6, "bossBoar"),
                  escorts: [
                    {
                      mobId: "followerBoar",
                      name: "Kaban Guard",
                      imagePortraitLink: null,
                      amounts: [{ count: 4, chance: 1 }],
                    },
                    {
                      mobId: "followerBoarClose1",
                      name: "Basmach",
                      imagePortraitLink: null,
                      amounts: [{ count: 1, chance: 1 }],
                    },
                  ],
                },
                {
                  ...boss("Raider", 0.4, "PmcBot"),
                  escorts: [
                    {
                      mobId: "PmcBot",
                      name: "Raider",
                      imagePortraitLink: null,
                      amounts: [
                        { count: 2, chance: 0.8 },
                        { count: 3, chance: 0.2 },
                      ],
                    },
                  ],
                },
                boss("Kollontay", 0.3, "bossKolontay"),
              ],
            }),
          ],
          mobs: [KABAN, KABAN_GUARD],
        }),
      );
      renderWithQueryClient(<MapBossStrips normalizedName="streets-of-tarkov" />);
    }

    async function open(name: string) {
      await userEvent.click(await screen.findByRole("button", { name: new RegExp(name) }));
      return within(await screen.findByRole("dialog", { name }));
    }

    it("switches the card between the boss and each guard, with squad sizes", async () => {
      mockEscortData();
      const card = await open("Kaban");

      expect(card.getByRole("tablist", { name: "Kaban and guards" })).toBeInTheDocument();
      expect(card.getByRole("tab", { name: "Kaban, boss" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      // The boss's own gear shows first.
      expect(card.getByRole("button", { name: /^Kalashnikov PKP/ })).toBeInTheDocument();

      await userEvent.click(card.getByRole("tab", { name: "Kaban Guard, 4 per spawn" }));
      expect(card.getByText("Kaban Guard")).toBeInTheDocument();
      expect(card.getByText(/· 4 per spawn/)).toBeInTheDocument();
      expect(card.queryByRole("button", { name: /^Kalashnikov PKP/ })).not.toBeInTheDocument();
      expect(
        card.getByRole("button", { name: /^RayBench Aviator glasses, about 100%/ }),
      ).toBeInTheDocument();
      expect(card.getByRole("button", { name: /^AFAK first aid kit, 50%/ })).toBeInTheDocument();
      // The header still names the boss and its spawn chance.
      expect(card.getByText(/spawn chance/)).toHaveTextContent("60% spawn chance");

      // A guard with no mob data still gets a tab, with the usual empty state.
      await userEvent.click(card.getByRole("tab", { name: "Basmach, 1 per spawn" }));
      expect(
        card.getByText("tarkov.dev has no gear or loot data for this enemy yet."),
      ).toBeInTheDocument();
    });

    it("starts back on the boss when the card is opened again", async () => {
      mockEscortData();
      const card = await open("Kaban");
      await userEvent.click(card.getByRole("tab", { name: "Kaban Guard, 4 per spawn" }));
      await userEvent.keyboard("{Escape}");

      const reopened = await open("Kaban");
      expect(reopened.getByRole("tab", { name: "Kaban, boss" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
    });

    it("shows a faction's group size instead of a guard tab for its own kind", async () => {
      mockEscortData();
      const card = await open("Raiders");
      expect(card.getByText("Spawns in groups of 3 to 4 (most often 3).")).toBeInTheDocument();
      expect(card.queryByRole("tablist", { name: /and guards/ })).not.toBeInTheDocument();
    });

    it("has no guard tabs for a boss that spawns alone", async () => {
      mockEscortData();
      const card = await open("Kollontay");
      expect(card.queryByRole("tablist", { name: /and guards/ })).not.toBeInTheDocument();
    });
  });

  describe("game mode, Ground Zero queue, and Partisan", () => {
    beforeEach(() => {
      useProgressTrackerStore.setState({
        profiles: [],
        activeProfileId: null,
        activeMode: "PVP",
        progressByProfile: {},
      });
    });

    /** Each pill's name, read from its hover title ("Name · 57% spawn chance · ..."). */
    function pillNames(): string[] {
      return screen
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-haspopup") === "dialog")
        .map((button) => button.getAttribute("title")?.split(" · ")[0] ?? "");
    }

    async function pillTitle(name: RegExp): Promise<string | null> {
      return (await screen.findByRole("button", { name })).getAttribute("title");
    }

    it("follows the header's game mode", async () => {
      vi.mocked(fetchTarkovGameData).mockResolvedValue(
        makeRawData({
          maps: [
            makeMap({
              name: "Woods",
              normalizedName: "woods",
              bosses: [boss("Shturman", 0.57)],
              bossesSeason: [boss("Shturman", 0.57), boss("Black Div.", 0.38)],
            }),
          ],
        }),
      );
      renderWithQueryClient(<MapBossStrips normalizedName="woods" />);
      await screen.findByRole("button", { name: /Shturman/ });
      expect(pillNames()).toEqual(["Shturman"]);

      act(() => {
        useProgressTrackerStore.getState().switchMode("PVP_SEASONAL");
      });
      expect(await screen.findByRole("button", { name: /Black Division/ })).toBeInTheDocument();
      expect(pillNames()).toEqual(["Shturman", "Black Division"]);
    });

    function mockGroundZero() {
      vi.mocked(fetchTarkovGameData).mockResolvedValue(
        makeRawData({
          maps: [
            makeMap({
              name: "Ground Zero",
              normalizedName: "ground-zero",
              bosses: [boss("Killa", 0.1)],
            }),
            makeMap({
              name: "Ground Zero 21+",
              normalizedName: "ground-zero-21",
              bosses: [boss("Killa", 0.3), boss("Cultist Priest", 0.4)],
            }),
          ],
        }),
      );
    }

    it("switches Ground Zero between its two level queues", async () => {
      mockGroundZero();
      renderWithQueryClient(<MapBossStrips normalizedName="ground-zero" />);

      const queue = await screen.findByRole("radiogroup", { name: "Ground Zero level queue" });
      expect(within(queue).getByRole("radio", { name: "Lvl ≤20" })).toHaveAttribute(
        "aria-checked",
        "true",
      );
      expect(await pillTitle(/Killa/)).toContain("Killa · 10% spawn chance");
      expect(screen.queryByRole("button", { name: /Cultists/ })).not.toBeInTheDocument();

      await userEvent.click(within(queue).getByRole("radio", { name: "Lvl 21+" }));
      expect(await pillTitle(/Killa/)).toContain("Killa · 30% spawn chance");
      expect(screen.getByRole("button", { name: /Cultists/ })).toBeInTheDocument();
    });

    it("starts Ground Zero on the queue the active profile's level lands in", async () => {
      const id = useProgressTrackerStore
        .getState()
        .createProfile({ name: "Main", face: null, mode: "PVP", faction: "USEC" });
      const key = `${id}:PVP` as const;
      const progress = useProgressTrackerStore.getState().progressByProfile[key];
      if (!progress) throw new Error("profile bucket missing");
      useProgressTrackerStore.setState({
        progressByProfile: { [key]: { ...progress, playerLevel: 34 } },
      });
      mockGroundZero();
      renderWithQueryClient(<MapBossStrips normalizedName="ground-zero" />);

      const queue = await screen.findByRole("radiogroup", { name: "Ground Zero level queue" });
      expect(within(queue).getByRole("radio", { name: "Lvl 21+" })).toHaveAttribute(
        "aria-checked",
        "true",
      );
    });

    it("explains Partisan's karma-driven spawn on his card in PvP, not in PvE", async () => {
      vi.mocked(fetchTarkovGameData).mockResolvedValue(
        makeRawData({
          maps: [
            makeMap({
              name: "Customs",
              normalizedName: "customs",
              bosses: [boss("Partisan", 0, "bossPartisan")],
            }),
          ],
        }),
      );
      renderWithQueryClient(<MapBossStrips normalizedName="customs" />);

      const pill = await screen.findByRole("button", { name: /Partisan/ });
      expect(pill).toHaveAttribute(
        "title",
        expect.stringContaining("higher with low-karma PMCs in the raid"),
      );
      await userEvent.click(pill);
      const card = within(await screen.findByRole("dialog", { name: "Partisan" }));
      expect(card.getByRole("region", { name: "How Partisan spawns" })).toHaveTextContent(
        "The lower the karma, the higher the chance of Partisan appearing.",
      );
      await userEvent.keyboard("{Escape}");

      act(() => {
        useProgressTrackerStore.getState().switchMode("PVE");
      });
      await userEvent.click(await screen.findByRole("button", { name: /Partisan/ }));
      const pveCard = within(await screen.findByRole("dialog", { name: "Partisan" }));
      expect(
        pveCard.queryByRole("region", { name: "How Partisan spawns" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("where and when", () => {
    beforeEach(() => {
      useProgressTrackerStore.setState({
        profiles: [],
        activeProfileId: null,
        activeMode: "PVP",
        progressByProfile: {},
      });
      useMapsStore.setState({ mapVariants: {} });
      useBossSpawnStore.setState({ shown: null });
    });

    const zone = (name: string, chance: number) => ({
      key: `Zone${name.replace(/\s+/g, "")}`,
      name,
      chance,
    });

    function mockCustoms(bosses: readonly RawMapBoss[]) {
      vi.mocked(fetchTarkovGameData).mockResolvedValue(
        makeRawData({
          maps: [
            makeMap({
              name: "Customs",
              normalizedName: "customs",
              raidDuration: 35,
              bosses,
              bossSpawnSpots: {
                ZoneStronghold: [
                  { x: 1, z: 1 },
                  { x: 2, z: 2 },
                  { x: 3, z: 3 },
                  { x: 4, z: 4 },
                  { x: 5, z: 5 },
                ],
              },
            }),
          ],
        }),
      );
    }

    const reshala: RawMapBoss = {
      ...boss("Reshala", 0.57, "bossBully"),
      spawnZones: [zone("Dorms", 0.33), zone("New Gas Station", 0.33), zone("Stronghold", 0.33)],
      spawnTiming: { kind: "start" },
    };

    it("lists the boss's zones and timing, and plots its spots on a view that can draw them", async () => {
      mockCustoms([reshala]);
      renderWithQueryClient(<MapBossStrips normalizedName="customs" />);
      await userEvent.click(await screen.findByRole("button", { name: /Reshala/ }));
      const card = within(await screen.findByRole("dialog", { name: "Reshala" }));

      expect(card.getByText("Where").nextElementSibling).toHaveTextContent(
        "Dorms 33% · New Gas Station 33% · Stronghold 33%",
      );
      expect(card.getByText("When").nextElementSibling).toHaveTextContent("At raid start");

      await userEvent.click(
        card.getByRole("button", { name: "Show Reshala's possible spawn spots on the map" }),
      );
      await vi.waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
      const shown = useBossSpawnStore.getState().shown;
      expect(shown).toMatchObject({
        map: "customs",
        mode: "PVP",
        name: "Reshala",
        zonesWithoutSpots: ["Dorms", "New Gas Station"],
      });
      expect(shown?.spots).toHaveLength(5);
      const variants = getMapConfig("customs")?.variants ?? [];
      const viewId = resolveVariantId(
        variants,
        useMapsStore.getState().mapVariants.customs ?? null,
      );
      const view = variants.find((variant) => variant.id === viewId);
      expect(view && variantHasAccurateMarkers(view)).toBe(true);
    });

    it("says Partisan roams the whole map, gives his timer, and offers no spots", async () => {
      mockCustoms([
        {
          ...boss("Partisan", 0, "bossPartisan"),
          spawnZones: [],
          spawnTiming: { kind: "timed", seconds: 900 },
        },
      ]);
      renderWithQueryClient(<MapBossStrips normalizedName="customs" />);
      await userEvent.click(await screen.findByRole("button", { name: /Partisan/ }));
      const card = within(await screen.findByRole("dialog", { name: "Partisan" }));

      expect(card.getByText("Where").nextElementSibling).toHaveTextContent("Roams the whole map");
      expect(card.getByText("When").nextElementSibling).toHaveTextContent("Can appear from 15:00");
      expect(
        card.queryByRole("button", { name: /spawn spots on the map/ }),
      ).not.toBeInTheDocument();
    });

    it("folds the zones after the first five behind '+N more'", async () => {
      const names = ["A", "B", "C", "D", "E", "F", "G"];
      mockCustoms([
        {
          ...boss("Black Div.", 0.4, "blackDivision"),
          spawnZones: names.map((name, index) => zone(name, 0.7 - index * 0.1)),
        },
      ]);
      renderWithQueryClient(<MapBossStrips normalizedName="customs" />);
      await userEvent.click(await screen.findByRole("button", { name: /Black Division/ }));
      const card = within(await screen.findByRole("dialog", { name: "Black Division" }));
      const where = card.getByText("Where").nextElementSibling;

      expect(where).toHaveTextContent("A 70% · B 60% · C 50% · D 40% · E 30% +2 more");
      await userEvent.click(card.getByRole("button", { name: "+2 more" }));
      expect(where).toHaveTextContent("E 30% · F 20% · G 10% Show fewer");
    });

    const raider = (overrides: Partial<RawMapBoss>): RawMapBoss => ({
      ...boss("Raider", 0.6, "pmcBot"),
      ...overrides,
    });

    function mockLabs() {
      vi.mocked(fetchTarkovGameData).mockResolvedValue(
        makeRawData({
          maps: [
            makeMap({
              name: "The Lab",
              normalizedName: "the-lab",
              raidDuration: 30,
              bosses: [
                raider({
                  spawnChance: 0.6,
                  spawnTiming: { kind: "timed", seconds: 300 },
                  spawnZones: [zone("Second Floor", 1)],
                }),
                raider({
                  spawnChance: 0.45,
                  spawnTiming: { kind: "start" },
                  spawnTrigger: { switchName: "Hangar Gate Switch" },
                  spawnZones: [zone("Hangar Gate", 1)],
                }),
                raider({
                  spawnChance: 0.35,
                  spawnTiming: { kind: "timed", seconds: 600 },
                  spawnTrigger: { switchName: "Hangar Gate Switch" },
                  spawnZones: [zone("First Floor", 0.5), zone("Second Floor", 0.5)],
                }),
                raider({
                  spawnChance: 0.35,
                  spawnTiming: { kind: "start" },
                  spawnTrigger: { switchName: null },
                  spawnZones: [zone("First Floor", 1)],
                }),
                { ...boss("Glukhar", 0.2, "bossGluhar"), spawnTiming: { kind: "start" } },
              ],
            }),
          ],
        }),
      );
    }

    it("lays a map's timed, triggered and raid-start spawns out in the Spawn timeline", async () => {
      mockLabs();
      renderWithQueryClient(<MapBossStrips normalizedName="the-lab" />);
      await userEvent.click(await screen.findByRole("button", { name: "Spawn timeline" }));
      const timeline = within(
        await screen.findByRole("dialog", { name: "The Lab spawn timeline" }),
      );

      expect(timeline.getByText(/PvP · 30 min raid/)).toBeInTheDocument();
      expect(timeline.getByText("During the raid")).toBeInTheDocument();
      expect(timeline.getByText("5:00")).toBeInTheDocument();
      expect(timeline.getByText("Hangar Gate Switch")).toBeInTheDocument();
      expect(timeline.getByText("Linked time: 10:00")).toBeInTheDocument();
      expect(timeline.getByText("Other extract switches")).toBeInTheDocument();
      expect(
        timeline.getByText(/Labs extracts not named above are Main Elevator/),
      ).toBeInTheDocument();
      expect(timeline.getByText("At raid start")).toBeInTheDocument();

      await userEvent.keyboard("{Escape}");
      await vi.waitFor(() => {
        expect(screen.getByRole("button", { name: "Spawn timeline" })).toHaveFocus();
      });
    });

    it("hands a triggered boss's card over to the Spawn timeline", async () => {
      mockLabs();
      renderWithQueryClient(<MapBossStrips normalizedName="the-lab" />);
      await userEvent.click(await screen.findByRole("button", { name: /Raiders/ }));
      const card = within(await screen.findByRole("dialog", { name: "Raiders" }));
      // Several spawns: zones by name only, likeliest first, never a row of "100%".
      expect(card.getByText("Where").nextElementSibling).toHaveTextContent(
        /^Second Floor · Hangar Gate · First Floor$/,
      );
      expect(card.getByText("When").nextElementSibling).toHaveTextContent(
        "Some spawns are triggered by switches: see the Spawn timeline",
      );

      await userEvent.click(card.getByRole("button", { name: "see the Spawn timeline" }));
      expect(
        await screen.findByRole("dialog", { name: "The Lab spawn timeline" }),
      ).toBeInTheDocument();
      expect(screen.queryByRole("dialog", { name: "Raiders" })).not.toBeInTheDocument();
    });

    it("has no Spawn timeline button when every spawn is at raid start", async () => {
      mockCustoms([reshala]);
      renderWithQueryClient(<MapBossStrips normalizedName="customs" />);
      await screen.findByRole("button", { name: /Reshala/ });
      expect(screen.queryByRole("button", { name: "Spawn timeline" })).not.toBeInTheDocument();
    });

    it("clears the spots when another Ground Zero queue is picked", async () => {
      vi.mocked(fetchTarkovGameData).mockResolvedValue(
        makeRawData({
          maps: [
            makeMap({
              name: "Ground Zero",
              normalizedName: "ground-zero",
              bosses: [boss("Killa", 0.1)],
            }),
            makeMap({ name: "Ground Zero 21+", normalizedName: "ground-zero-21", bosses: [] }),
          ],
        }),
      );
      useBossSpawnStore.getState().show({
        map: "ground-zero",
        mode: "PVP",
        name: "Killa",
        imagePortraitLink: null,
        tone: "cool",
        spots: [{ x: 1, z: 1, zone: "Office" }],
        zonesWithoutSpots: [],
      });
      renderWithQueryClient(<MapBossStrips normalizedName="ground-zero" />);
      const queue = await screen.findByRole("radiogroup", { name: "Ground Zero level queue" });
      await userEvent.click(within(queue).getByRole("radio", { name: "Lvl 21+" }));
      expect(useBossSpawnStore.getState().shown).toBeNull();
    });
  });
});
