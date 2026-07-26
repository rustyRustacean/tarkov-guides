import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";
import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useMapsStore } from "../store";

import { MapScreenLayout } from "./MapScreenLayout";

import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

// `SessionControls` (rendered as part of this layout's floating chrome) reads
// the invite-link `?session=` param via `next/navigation` - this test
// environment has no real Next.js app router mounted, so it needs the same
// mock `Header.test.tsx` already established for that hook family.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/maps",
  useSearchParams: () => new URLSearchParams(),
}));

// `MapSessionRoomProvider` is mounted one level up (`MapsPage.tsx`) in the
// real app, so a bare `<MapScreenLayout>` here has no `RoomProvider`
// ancestor for the several components under it that call session hooks
// (`SessionControls`, `MapVariantSwitcher`, `AnnotationCanvas`, `MapViewer`'s
// `SessionViewSync`). This file tests layout/panel behavior, not
// collaborative-session behavior, so mocking "no session active" is the
// right scope rather than standing up a real room.
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
vi.mock("../session/use-session-annotation-layer", () => ({
  useSessionAnnotationLayer: () => null,
}));
vi.mock("../session/use-session-inactivity-close", () => ({
  useSessionInactivityClose: () => undefined,
}));

const initialProgressState = useProgressTrackerStore.getInitialState();
const initialMapsState = useMapsStore.getInitialState();

function mockViewport(isMobile: boolean): void {
  window.matchMedia = (query: string) =>
    ({
      matches: isMobile,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

beforeEach(() => {
  useProgressTrackerStore.setState(initialProgressState, true);
  useMapsStore.setState(initialMapsState, true);
  mockViewport(false);
});

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

function mapRef(normalizedName: string): { name: string; normalizedName: string } {
  return { name: normalizedName, normalizedName };
}

function activateProfile(): string {
  return useProgressTrackerStore
    .getState()
    .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
}

/** An inprog task relevant to `reserve` - gives `useMapSidebarHasContent` something to find, so the left panel starts expanded instead of auto-collapsing. */
function activateProfileWithRelevantTask(): void {
  activateProfile();
  const task = makeTask({ id: "t1", map: mapRef("reserve") });
  vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));
  useProgressTrackerStore.getState().setTaskStatuses({ t1: { status: "inprog" } });
}

describe("MapScreenLayout", () => {
  it("renders the desktop 3-column layout with the Valuables panel collapsed by default", async () => {
    activateProfileWithRelevantTask();
    const { container } = renderWithQueryClient(<MapScreenLayout normalizedName="reserve" />);

    expect(await screen.findByRole("searchbox", { name: "Search tasks" })).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector(".leaflet-container")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Expand valuables panel" })).toBeInTheDocument();
    expect(screen.queryByText(/Min\. 24h avg price/)).not.toBeInTheDocument();
    // TarkovClock now lives in the map-picker row (`MapsPage.tsx`), not here.
    expect(screen.queryByText("L")).not.toBeInTheDocument();
  });

  it("expanding the right panel shows the Valuables panel content", async () => {
    activateProfileWithRelevantTask();
    renderWithQueryClient(<MapScreenLayout normalizedName="reserve" />);
    await screen.findByRole("searchbox", { name: "Search tasks" });

    fireEvent.click(screen.getByRole("button", { name: "Expand valuables panel" }));

    expect(screen.getByText(/Min\. 24h avg price/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse valuables panel" })).toBeInTheDocument();
  });

  it("collapsing the left panel hides the Items/Tasks sidebar and can be re-expanded", async () => {
    activateProfileWithRelevantTask();
    renderWithQueryClient(<MapScreenLayout normalizedName="reserve" />);
    await screen.findByRole("searchbox", { name: "Search tasks" });

    fireEvent.click(screen.getByRole("button", { name: "Collapse items & tasks panel" }));

    expect(screen.queryByRole("searchbox", { name: "Search tasks" })).not.toBeInTheDocument();
    const expandButton = screen.getByRole("button", { name: "Expand items & tasks panel" });
    expect(expandButton).toBeInTheDocument();

    fireEvent.click(expandButton);

    expect(await screen.findByRole("searchbox", { name: "Search tasks" })).toBeInTheDocument();
  });

  it("defaults the left panel to collapsed when the active profile has no items or tasks for this map", async () => {
    activateProfile();
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<MapScreenLayout normalizedName="reserve" />);

    expect(
      await screen.findByRole("button", { name: "Expand items & tasks panel" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Search tasks" })).not.toBeInTheDocument();
  });

  it("defaults the left panel to collapsed when there is no active profile at all", async () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<MapScreenLayout normalizedName="reserve" />);

    expect(
      await screen.findByRole("button", { name: "Expand items & tasks panel" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("searchbox", { name: "Search tasks" })).not.toBeInTheDocument();
  });

  it("leaves the left panel expanded by default when an inprog task is relevant to this map", async () => {
    activateProfile();
    const task = makeTask({ id: "t1", map: mapRef("reserve") });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [task] }));
    useProgressTrackerStore.getState().setTaskStatuses({ t1: { status: "inprog" } });

    renderWithQueryClient(<MapScreenLayout normalizedName="reserve" />);

    expect(await screen.findByRole("searchbox", { name: "Search tasks" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Collapse items & tasks panel" }),
    ).toBeInTheDocument();
  });

  it("renders the mobile layout with a sheet handle and hides the Valuables panel entirely", async () => {
    mockViewport(true);
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    const { container } = renderWithQueryClient(<MapScreenLayout normalizedName="reserve" />);

    expect(await screen.findByText(/Toggle Items & Tasks panel/)).toBeInTheDocument();
    await waitFor(() => {
      expect(container.querySelector(".leaflet-container")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /valuables panel/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Min\. 24h avg price/)).not.toBeInTheDocument();
  });

  it("clicking the fullscreen button requests fullscreen on the map column", async () => {
    const requestFullscreen = vi.spyOn(Element.prototype, "requestFullscreen");
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<MapScreenLayout normalizedName="reserve" />);

    fireEvent.click(await screen.findByRole("button", { name: "Fullscreen map (F)" }));

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    requestFullscreen.mockRestore();
  });

  it("tapping the mobile sheet handle toggles mobileSheetOpen in the store", async () => {
    mockViewport(true);
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<MapScreenLayout normalizedName="reserve" />);
    const handle = await screen.findByRole("button", { name: /Toggle Items & Tasks panel/ });

    expect(useMapsStore.getState().mobileSheetOpen).toBe(false);

    fireEvent.pointerDown(handle, { clientY: 500, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientY: 500, pointerId: 1 });

    expect(useMapsStore.getState().mobileSheetOpen).toBe(true);
  });
});
