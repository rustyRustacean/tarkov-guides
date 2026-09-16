import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCompanionStatus, useMapFollowPreference } from "@/features/companion/use-companion";
import { useTarkovGameData } from "@/shared/lib/tarkov-api/use-tarkov-game-data";

import { useMapsStore } from "../store";

import { decideMapFollowTarget, useCompanionMapFollow } from "./use-companion-map-follow";

import type { CompanionStatus } from "@/features/companion/companion-config";
import type { RawMap } from "@/shared/lib/tarkov-api/types";

vi.mock("@/features/companion/use-companion", () => ({
  useCompanionStatus: vi.fn(),
  useMapFollowPreference: vi.fn(),
}));

vi.mock("@/shared/lib/tarkov-api/use-tarkov-game-data", () => ({
  useTarkovGameData: vi.fn(),
}));

function map(normalizedName: string, nameId: string | null): RawMap {
  return {
    name: normalizedName,
    normalizedName,
    nameId,
    raidDuration: null,
    players: null,
    bosses: [],
  };
}

const MAPS: readonly RawMap[] = [map("reserve", "RezervBase"), map("customs", "bigmap")];

function status(overrides: Partial<CompanionStatus> = {}): CompanionStatus {
  return {
    app: "MasterTarkov-Companion",
    version: "2.2.0",
    running: true,
    session: "log_x",
    gameVersion: "1.1.0.0.46624",
    mode: "pvp",
    profileId: "p1",
    faction: "BEAR",
    questsAvailable: true,
    quests: {},
    questCounts: { started: 0, finished: 0, failed: 0 },
    position: null,
    positionRevision: 0,
    raidLocation: null,
    revision: 1,
    updatedAt: 0,
    ...overrides,
  };
}

describe("decideMapFollowTarget", () => {
  it("switches to the resolved tab when it differs from the current map", () => {
    expect(decideMapFollowTarget("bigmap", MAPS, "reserve")).toBe("customs");
  });

  it("does nothing when the resolved tab is already open", () => {
    expect(decideMapFollowTarget("bigmap", MAPS, "customs")).toBeNull();
  });

  it("does nothing for an unresolvable location", () => {
    expect(decideMapFollowTarget("SomeNewMap2027", MAPS, "reserve")).toBeNull();
    expect(decideMapFollowTarget(null, MAPS, "reserve")).toBeNull();
  });
});

describe("useCompanionMapFollow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMapsStore.setState({ currentMap: "reserve", mapVariants: {} });
    vi.mocked(useMapFollowPreference).mockReturnValue([true, vi.fn()]);
    vi.mocked(useTarkovGameData).mockReturnValue({ data: { maps: MAPS } } as never);
  });

  it("does nothing while the preference is off", () => {
    vi.mocked(useMapFollowPreference).mockReturnValue([false, vi.fn()]);
    vi.mocked(useCompanionStatus).mockReturnValue({
      status: status({ raidLocation: "bigmap" }),
    } as never);

    renderHook(() => {
      useCompanionMapFollow();
    });

    expect(useMapsStore.getState().currentMap).toBe("reserve");
  });

  it("switches to the raid's map when a new raid starts", () => {
    vi.mocked(useCompanionStatus).mockReturnValue({
      status: status({ raidLocation: "bigmap" }),
    } as never);

    renderHook(() => {
      useCompanionMapFollow();
    });

    expect(useMapsStore.getState().currentMap).toBe("customs");
  });

  it("does not re-switch for the same raidLocation value on a rerender", () => {
    vi.mocked(useCompanionStatus).mockReturnValue({
      status: status({ raidLocation: "bigmap" }),
    } as never);
    const { rerender } = renderHook(() => {
      useCompanionMapFollow();
    });
    act(() => {
      useMapsStore.getState().setCurrentMap("reserve"); // simulate the user navigating back
    });

    rerender();

    expect(useMapsStore.getState().currentMap).toBe("reserve");
  });

  it("switches again once a genuinely new raidLocation arrives", () => {
    vi.mocked(useCompanionStatus).mockReturnValue({
      status: status({ raidLocation: "bigmap" }),
    } as never);
    const { rerender } = renderHook(() => {
      useCompanionMapFollow();
    });

    vi.mocked(useCompanionStatus).mockReturnValue({
      status: status({ raidLocation: "RezervBase" }),
    } as never);
    rerender();

    expect(useMapsStore.getState().currentMap).toBe("reserve");
  });

  it("pulls back on every new positionRevision even when the resolved map repeats", () => {
    vi.mocked(useCompanionStatus).mockReturnValue({
      status: status({
        position: { x: 1, z: 2, yaw: 0, at: 1, map: "bigmap" },
        positionRevision: 1,
      }),
    } as never);
    const { rerender } = renderHook(() => {
      useCompanionMapFollow();
    });
    expect(useMapsStore.getState().currentMap).toBe("customs");

    act(() => {
      useMapsStore.getState().setCurrentMap("reserve"); // user wandered off
    });
    vi.mocked(useCompanionStatus).mockReturnValue({
      status: status({
        position: { x: 3, z: 4, yaw: 0, at: 2, map: "bigmap" },
        positionRevision: 2,
      }),
    } as never);
    rerender();

    expect(useMapsStore.getState().currentMap).toBe("customs");
  });

  it("ignores a screenshot whose map can't be resolved", () => {
    vi.mocked(useCompanionStatus).mockReturnValue({
      status: status({ position: { x: 1, z: 2, yaw: 0, at: 1, map: null }, positionRevision: 1 }),
    } as never);

    renderHook(() => {
      useCompanionMapFollow();
    });

    expect(useMapsStore.getState().currentMap).toBe("reserve");
  });

  it("also switches a sticky non-marker variant so the marker is actually visible", () => {
    // THE two-week bug: following onto Customs while its remembered variant
    // was "2d" landed on a view where PlayerMarker is never mounted.
    useMapsStore.setState({ mapVariants: { customs: "2d" } });
    vi.mocked(useCompanionStatus).mockReturnValue({
      status: status({ raidLocation: "bigmap" }),
    } as never);

    renderHook(() => {
      useCompanionMapFollow();
    });

    expect(useMapsStore.getState().currentMap).toBe("customs");
    expect(useMapsStore.getState().mapVariants.customs).toBe("interactive");
  });

  it("fixes the variant even when already on the raid's map", () => {
    useMapsStore.setState({ currentMap: "customs", mapVariants: { customs: "2d" } });
    vi.mocked(useCompanionStatus).mockReturnValue({
      status: status({ raidLocation: "bigmap" }),
    } as never);

    renderHook(() => {
      useCompanionMapFollow();
    });

    expect(useMapsStore.getState().mapVariants.customs).toBe("interactive");
  });

  it("never overrides a deliberate marker-capable variant choice", () => {
    useMapsStore.setState({ mapVariants: { customs: "interactive" } });
    vi.mocked(useCompanionStatus).mockReturnValue({
      status: status({ raidLocation: "bigmap" }),
    } as never);

    renderHook(() => {
      useCompanionMapFollow();
    });

    expect(useMapsStore.getState().mapVariants.customs).toBe("interactive");
  });

  it("leaves the raid trigger unconsumed until game data loads, then switches", () => {
    // The consumed-trigger race: the companion's tiny /status answers before
    // the multi-MB game-data fetch. Advancing the dedupe ref on that first
    // render permanently ate the raid-start switch.
    vi.mocked(useTarkovGameData).mockReturnValue({ data: undefined } as never);
    vi.mocked(useCompanionStatus).mockReturnValue({
      status: status({ raidLocation: "bigmap" }),
    } as never);
    const { rerender } = renderHook(() => {
      useCompanionMapFollow();
    });
    expect(useMapsStore.getState().currentMap).toBe("reserve");

    vi.mocked(useTarkovGameData).mockReturnValue({ data: { maps: MAPS } } as never);
    rerender();

    expect(useMapsStore.getState().currentMap).toBe("customs");
  });
});
