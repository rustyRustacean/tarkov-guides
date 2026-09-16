import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { QuestTreeView } from "./QuestTreeView";

import type { RawTarkovApiResponseData, RawTask } from "@/shared/lib/tarkov-api/types";

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();

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
    tasks: [],
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

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
});

afterEach(() => {
  // Safety net for the fake-timer search-highlight test below. A no-op if
  // real timers are already active.
  vi.useRealTimers();
});

describe("QuestTreeView", () => {
  it("shows a no-active-profile message when nothing is active", () => {
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData());
    renderWithQueryClient(<QuestTreeView />);
    expect(screen.getByText(/no active profile/i)).toBeInTheDocument();
  });

  it("renders a node per available task once live data resolves", async () => {
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestTreeView />);

    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });
    expect(screen.getByText("1 quests shown")).toBeInTheDocument();
  });

  it("shows locked tasks by default, hiding them via the Show locked checkbox", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    const cans = makeTask({
      id: "cans",
      name: "Shooting Cans",
      taskRequirements: [{ task: { id: "debut" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, cans] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestTreeView />);

    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });
    expect(screen.getByText("Shooting Cans")).toBeInTheDocument();
    expect(screen.getByText("2 quests shown")).toBeInTheDocument();

    await user.click(screen.getByText("Show locked"));
    expect(screen.queryByText("Shooting Cans")).not.toBeInTheDocument();
    expect(screen.getByText("1 quests shown")).toBeInTheDocument();
  });

  it("filters to only Kappa-required tasks when the checkbox is toggled", async () => {
    const user = userEvent.setup();
    const kappaTask = makeTask({ id: "kappa-task", name: "Kappa Task", kappaRequired: true });
    const normalTask = makeTask({ id: "normal-task", name: "Normal Task", kappaRequired: false });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [kappaTask, normalTask] }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Normal Task")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Kappa only"));
    expect(screen.queryByText("Normal Task")).not.toBeInTheDocument();
    expect(screen.getByText("Kappa Task")).toBeInTheDocument();
  });

  it("highlights a hovered task's connected edge and clears it on unhover", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    const cans = makeTask({
      id: "cans",
      name: "Shooting Cans",
      taskRequirements: [{ task: { id: "debut" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, cans] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { container } = renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });
    // "Shooting Cans" is locked (requires "Debut") but shown by default, so
    // its connecting edge already renders with no extra setup.
    await waitFor(() => {
      expect(screen.getByText("Shooting Cans")).toBeInTheDocument();
    });

    // Scoped to the pannable canvas: the `Checkbox` components in the
    // toolbar above also render an SVG `<path>` (their checkmark), which an
    // unscoped `container.querySelector("path")` would match first instead.
    const canvas = container.querySelector('[style*="translate"]');
    if (!canvas) throw new Error("tree canvas not found");
    const edge = canvas.querySelector("path");
    expect(edge).not.toHaveClass("stroke-primary");

    await user.hover(screen.getByRole("button", { name: /Debut/ }));
    expect(edge).toHaveClass("stroke-primary");

    await user.unhover(screen.getByRole("button", { name: /Debut/ }));
    expect(edge).not.toHaveClass("stroke-primary");
  });

  it("hides Collector's prerequisite/dependent edges by default, revealing them via its own eye-icon toggle", async () => {
    const user = userEvent.setup();
    const prereq = makeTask({ id: "prereq", name: "Some Prereq" });
    const collector = makeTask({
      id: "collector",
      name: "Collector",
      trader: { id: "fence", name: "Fence", imageLink: null },
      taskRequirements: [{ task: { id: "prereq" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [prereq, collector] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { container } = renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Collector")).toBeInTheDocument();
    });

    // Scoped to the edges `<svg>` specifically (its own
    // `pointer-events-none` class), not just the pannable canvas: the
    // Collector node's own eye-icon toggle button also renders an SVG
    // `<path>` (its Eye/EyeOff glyph), which an unscoped `canvas
    // .querySelector("path")` would match regardless of whether any edge
    // is actually showing.
    const canvas = container.querySelector('[style*="translate"]');
    if (!canvas) throw new Error("tree canvas not found");
    const edgesSvg = canvas.querySelector("svg.pointer-events-none");
    if (!edgesSvg) throw new Error("edges svg not found");
    expect(edgesSvg.querySelector("path")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show Collector's prerequisite lines" }));
    expect(edgesSvg.querySelector("path")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide Collector's prerequisite lines" }));
    expect(edgesSvg.querySelector("path")).not.toBeInTheDocument();
  });

  it("zooms in response to a wheel event on the tree viewport", async () => {
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { container } = renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    expect(screen.getByText("100%")).toBeInTheDocument();
    const viewport = container.querySelector(".overflow-hidden");
    if (!viewport) throw new Error("tree viewport not found");
    fireEvent.wheel(viewport, { deltaY: -100 });
    expect(screen.getByText(/1[0-9][0-9]%/)).toBeInTheDocument();
  });

  it("pans via click-and-drag", async () => {
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { container } = renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    const viewport = container.querySelector(".overflow-hidden");
    if (!viewport) throw new Error("tree viewport not found");
    const nodeLayer = container.querySelector('[style*="translate"]');
    if (!nodeLayer) throw new Error("pannable node layer not found");
    const transformBefore = (nodeLayer as HTMLElement).style.transform;

    fireEvent.mouseDown(viewport, { button: 0, clientX: 100, clientY: 100 });
    // Drag-pan applies each move as a `movementX`/`movementY` delta (see
    // `handlePointerDown`'s doc comment) rather than an absolute
    // `clientX`/`clientY` offset from mousedown. jsdom doesn't synthesize
    // `movementX`/`movementY` from successive `clientX`/`clientY` values, so
    // this has to supply the delta explicitly.
    fireEvent.mouseMove(window, { clientX: 140, clientY: 160, movementX: 40, movementY: 60 });
    fireEvent.mouseUp(window);

    expect((nodeLayer as HTMLElement).style.transform).not.toBe(transformBefore);
  });

  it("opens the quest detail dialog when a node is clicked", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Debut/ }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText("Debut").length).toBeGreaterThan(1);
  });

  it("gives the 'Available' legend swatch a neutral border, not an amber one", async () => {
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    // The label text is a direct text-node child of the legend item's own
    // wrapping `<span>` (not a separate element), so `getByText` matches
    // that wrapper; the swatch is its child, not its sibling.
    const swatch = screen.getByText("Available").querySelector("span");
    expect(swatch).toHaveClass("border-border");
    expect(swatch).not.toHaveClass("border-status-amber");
  });

  it("pans when a 'Jump to' trader button is clicked", async () => {
    const user = userEvent.setup();
    const skierTask = makeTask({
      id: "skier-task",
      name: "Skier Task",
      trader: { id: "skier", name: "Skier", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [skierTask] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { container } = renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Skier Task")).toBeInTheDocument();
    });

    const nodeLayer = container.querySelector('[style*="translate"]');
    if (!nodeLayer) throw new Error("pannable node layer not found");
    const transformBefore = (nodeLayer as HTMLElement).style.transform;

    await user.click(screen.getByRole("button", { name: "Skier" }));

    expect((nodeLayer as HTMLElement).style.transform).not.toBe(transformBefore);
  });

  it("animates the pan/zoom layer's transform when a 'Jump to' trader button is clicked", async () => {
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { container } = renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    const nodeLayer = container.querySelector('[style*="translate"]');
    if (!nodeLayer) throw new Error("pannable node layer not found");
    // No transition for drag-pan/wheel-zoom/initial positioning: only a
    // "Jump to" trader button click should animate.
    expect((nodeLayer as HTMLElement).style.transition).toBe("none");

    fireEvent.click(screen.getByRole("button", { name: "Trader" }));
    expect((nodeLayer as HTMLElement).style.transition).toContain("transform");
  });

  it("centers the whole trader row on initial load instead of jumping to any one trader's lane", async () => {
    const praporTask = makeTask({
      id: "prapor-task",
      name: "Prapor Task",
      trader: { id: "prapor", name: "Prapor", imageLink: null },
    });
    const skierTask = makeTask({
      id: "skier-task",
      name: "Skier Task",
      trader: { id: "skier", name: "Skier", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [praporTask, skierTask] }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const user = userEvent.setup();
    const { container } = renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Prapor Task")).toBeInTheDocument();
    });

    const nodeLayer = container.querySelector('[style*="translate"]');
    if (!nodeLayer) throw new Error("pannable node layer not found");
    const transformAfterMount = (nodeLayer as HTMLElement).style.transform;

    // A "Jump to" click pins a specific lane at the top-center with a fixed
    // top inset (`computeTraderJumpPan`); the generic recenter the mount
    // effect uses instead centers the whole layout at the viewport's own
    // top edge, a different y (and, absent Prapor sitting exactly at the
    // layout's horizontal midpoint, a different x too). Either trader's
    // jump button should therefore move the transform away from wherever
    // the mount effect landed.
    await user.click(screen.getByRole("button", { name: "Prapor" }));
    expect((nodeLayer as HTMLElement).style.transform).not.toBe(transformAfterMount);

    await user.click(screen.getByRole("button", { name: "Skier" }));
    const transformAfterSkier = (nodeLayer as HTMLElement).style.transform;
    expect(transformAfterSkier).not.toBe(transformAfterMount);

    // Sanity check that the jump math actually differs by trader (i.e. this
    // isn't vacuously true because every jump lands on the same spot).
    await user.click(screen.getByRole("button", { name: "Prapor" }));
    expect((nodeLayer as HTMLElement).style.transform).not.toBe(transformAfterSkier);
  });

  it("renders one lane header per trader with a currently-visible task", async () => {
    const praporTask = makeTask({
      id: "prapor-task",
      name: "Prapor Task",
      trader: { id: "prapor", name: "Prapor", imageLink: null },
    });
    const skierTask = makeTask({
      id: "skier-task",
      name: "Skier Task",
      trader: { id: "skier", name: "Skier", imageLink: null },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(
      makeRawData({ tasks: [praporTask, skierTask] }),
    );
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { container } = renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Prapor Task")).toBeInTheDocument();
    });

    // Scoped to the pannable canvas: the trader legend overlay always lists
    // every known trader regardless of visibility, so an unscoped query
    // would match both.
    const canvas = container.querySelector<HTMLElement>('[style*="translate"]');
    if (!canvas) throw new Error("tree canvas not found");
    expect(within(canvas).getByText("Prapor")).toBeInTheDocument();
    expect(within(canvas).getByText("Skier")).toBeInTheDocument();
  });

  it("renders a trader's lane header as their avatar image when the task data has one", async () => {
    const praporTask = makeTask({
      id: "prapor-task",
      name: "Prapor Task",
      trader: { id: "prapor", name: "Prapor", imageLink: "https://example.test/prapor.png" },
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [praporTask] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { container } = renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Prapor Task")).toBeInTheDocument();
    });

    expect(
      container.querySelector('img[src="https://example.test/prapor.png"]'),
    ).toBeInTheDocument();
  });

  it("collapses a real multi-part chain into one stacked node by default", async () => {
    const p1 = makeTask({ id: "signal-1", name: "Signal - Part 1" });
    const p2 = makeTask({
      id: "signal-2",
      name: "Signal - Part 2",
      taskRequirements: [{ task: { id: "signal-1" }, status: ["complete"] }],
    });
    const p3 = makeTask({
      id: "signal-3",
      name: "Signal - Part 3",
      taskRequirements: [{ task: { id: "signal-2" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [p1, p2, p3] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestTreeView />);
    // Parts 2/3 are locked (each requires the part before it) but shown by
    // default, so all 3 parts are already visible to form the full chain
    // with no extra setup.
    await waitFor(() => {
      expect(screen.getByText("Signal")).toBeInTheDocument();
    });

    expect(screen.getByText(/3 parts/)).toBeInTheDocument();
    expect(screen.queryByText("Signal - Part 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Signal - Part 2")).not.toBeInTheDocument();
  });

  it("draws a second, decorative card behind a collapsed multi-part chain node (a 'stack of cards' cue)", async () => {
    const p1 = makeTask({ id: "signal-1", name: "Signal - Part 1" });
    const p2 = makeTask({
      id: "signal-2",
      name: "Signal - Part 2",
      taskRequirements: [{ task: { id: "signal-1" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [p1, p2] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Signal")).toBeInTheDocument();
    });

    const chainButton = screen.getByRole("button", { name: /Signal, collapsed chain of 2 parts/ });
    const ghostCard = chainButton.previousElementSibling;
    expect(ghostCard).toBeInTheDocument();
    expect(ghostCard).toHaveAttribute("aria-hidden", "true");
  });

  it("draws one ghost card per extra part - a 3-part chain shows 3 total cards", async () => {
    const p1 = makeTask({ id: "signal-1", name: "Signal - Part 1" });
    const p2 = makeTask({
      id: "signal-2",
      name: "Signal - Part 2",
      taskRequirements: [{ task: { id: "signal-1" }, status: ["complete"] }],
    });
    const p3 = makeTask({
      id: "signal-3",
      name: "Signal - Part 3",
      taskRequirements: [{ task: { id: "signal-2" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [p1, p2, p3] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Signal")).toBeInTheDocument();
    });

    const chainButton = screen.getByRole("button", { name: /Signal, collapsed chain of 3 parts/ });
    const nearGhost = chainButton.previousElementSibling;
    expect(nearGhost).toHaveAttribute("aria-hidden", "true");
    const farGhost = nearGhost?.previousElementSibling;
    expect(farGhost).toHaveAttribute("aria-hidden", "true");
    // Only 2 ghosts for 3 parts; nothing further back.
    expect(farGhost?.previousElementSibling).not.toHaveAttribute("aria-hidden", "true");
  });

  it("expands a chain in place on click revealing ordered mini-parts, opens a part's own detail dialog, and collapses back on a second click", async () => {
    const p1 = makeTask({ id: "signal-1", name: "Signal - Part 1" });
    const p2 = makeTask({
      id: "signal-2",
      name: "Signal - Part 2",
      taskRequirements: [{ task: { id: "signal-1" }, status: ["complete"] }],
    });
    const p3 = makeTask({
      id: "signal-3",
      name: "Signal - Part 3",
      taskRequirements: [{ task: { id: "signal-2" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [p1, p2, p3] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const user = userEvent.setup();
    renderWithQueryClient(<QuestTreeView />);
    // All 3 parts are shown by default (locked ones included), so the chain
    // is already detected and collapsed with no extra setup.
    await waitFor(() => {
      expect(screen.getByText("Signal")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Signal, collapsed chain of 3 parts/ }));

    const part1Button = screen.getByText("Signal - Part 1").closest("button");
    const part2Button = screen.getByText("Signal - Part 2").closest("button");
    const part3Button = screen.getByText("Signal - Part 3").closest("button");
    if (!part1Button || !part2Button || !part3Button)
      throw new Error("mini-part buttons not found");
    // Ordered top-to-bottom.
    expect(parseFloat(part1Button.style.top)).toBeLessThan(parseFloat(part2Button.style.top));
    expect(parseFloat(part2Button.style.top)).toBeLessThan(parseFloat(part3Button.style.top));

    await user.click(part2Button);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getAllByText("Signal - Part 2").length).toBeGreaterThan(1);
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /collapse/i }));
    expect(screen.queryByText("Signal - Part 1")).not.toBeInTheDocument();
    expect(screen.getByText(/3 parts/)).toBeInTheDocument();
  });

  it("collapses a cross-trader chain (e.g. real 'Colleagues') into one node placed in the first part's lane", async () => {
    const p1 = makeTask({
      id: "colleagues-1",
      name: "Colleagues - Part 1",
      trader: { id: "peacekeeper", name: "Peacekeeper", imageLink: null },
    });
    const p2 = makeTask({
      id: "colleagues-2",
      name: "Colleagues - Part 2",
      trader: { id: "prapor", name: "Prapor", imageLink: null },
      taskRequirements: [{ task: { id: "colleagues-1" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [p1, p2] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Colleagues")).toBeInTheDocument();
    });
    expect(screen.getByText(/2 parts/)).toBeInTheDocument();
    expect(screen.getByText(/Peacekeeper → Prapor/)).toBeInTheDocument();
  });

  it("does not collapse two same-base-name tasks that lack the real prerequisite link", async () => {
    const a = makeTask({ id: "foo-a", name: "Foo - Part 1" });
    const b = makeTask({ id: "foo-b", name: "Foo - Part 2" }); // no taskRequirements linking them
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [a, b] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Foo - Part 1")).toBeInTheDocument();
    });
    expect(screen.getByText("Foo - Part 2")).toBeInTheDocument();
    expect(screen.queryByText(/\d+ parts/)).not.toBeInTheDocument();
  });

  it("always shows the toolbar controls row, with no collapse toggle", async () => {
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Kappa only")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Hide controls" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show controls" })).not.toBeInTheDocument();
  });

  it("zooms in and out via the +/- icon buttons", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("100%")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(screen.getByText("120%")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("clicking the fullscreen button requests fullscreen on the tree wrapper", async () => {
    const requestFullscreen = vi.spyOn(Element.prototype, "requestFullscreen");
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const user = userEvent.setup();
    renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Fullscreen (F)" }));

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    requestFullscreen.mockRestore();
  });

  it("adds top padding above the toolbar row once fullscreen, with none beforehand", async () => {
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { container } = renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Kappa only")).toBeInTheDocument();
    });

    const toolbarRow = screen.getByText("Kappa only").parentElement;
    expect(toolbarRow).not.toHaveClass("pt-4");

    const wrapper = container.firstChild;
    expect(wrapper).toBeInstanceOf(HTMLElement);
    Object.defineProperty(document, "fullscreenElement", {
      value: wrapper,
      configurable: true,
    });
    fireEvent(document, new Event("fullscreenchange"));

    expect(toolbarRow).toHaveClass("pt-4");

    Object.defineProperty(document, "fullscreenElement", { value: null, configurable: true });
  });

  it("collapses the legend into a small toggle button, expandable again", async () => {
    const user = userEvent.setup();
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestTreeView />);
    await waitFor(() => {
      expect(screen.getByText("Legend")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Hide legend" }));
    expect(screen.queryByText("Legend")).not.toBeInTheDocument();
    expect(screen.queryByText("Available")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show legend" }));
    expect(screen.getByText("Legend")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  it("autozooms and highlights a task once given a focusRequest for it (as QuestBoard sends after a search-dropdown click)", async () => {
    const debut = makeTask({ id: "debut", name: "Debut" });
    const shootingCans = makeTask({ id: "cans", name: "Shooting Cans" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, shootingCans] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { container, rerender } = renderWithQueryClient(<QuestTreeView focusRequest={null} />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    const nodeLayer = container.querySelector('[style*="translate"]');
    if (!nodeLayer) throw new Error("pannable node layer not found");
    const transformBefore = (nodeLayer as HTMLElement).style.transform;
    expect(screen.getByRole("button", { name: /Shooting Cans/ })).not.toHaveClass("ring-4");

    rerender(<QuestTreeView focusRequest={{ taskId: "cans", nonce: 1 }} />);

    expect((nodeLayer as HTMLElement).style.transform).not.toBe(transformBefore);
    expect((nodeLayer as HTMLElement).style.transition).toContain("transform");
    expect(screen.getByRole("button", { name: /Shooting Cans/ })).toHaveClass("ring-4");
    // "Debut" wasn't the requested task, so it's never highlighted.
    expect(screen.getByRole("button", { name: /Debut/ })).not.toHaveClass("ring-4");
  });

  it("clears the search highlight a couple seconds after the jump", async () => {
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { rerender } = renderWithQueryClient(<QuestTreeView focusRequest={null} />);
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    // Only switches to fake timers now: the data-loading `waitFor` above
    // needs real ones to ever resolve.
    vi.useFakeTimers();
    rerender(<QuestTreeView focusRequest={{ taskId: "debut", nonce: 1 }} />);
    expect(screen.getByRole("button", { name: /Debut/ })).toHaveClass("ring-4");

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByRole("button", { name: /Debut/ })).not.toHaveClass("ring-4");
  });

  it("does not re-jump on a re-render that still carries the same already-handled focusRequest", async () => {
    const debut = makeTask({ id: "debut", name: "Debut" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const focusRequest = { taskId: "debut", nonce: 1 };
    const { container, rerender } = renderWithQueryClient(
      <QuestTreeView focusRequest={focusRequest} />,
    );
    await waitFor(() => {
      expect(screen.getByText("Debut")).toBeInTheDocument();
    });

    const nodeLayer = container.querySelector('[style*="translate"]');
    if (!nodeLayer) throw new Error("pannable node layer not found");
    const transformAfterFirstJump = (nodeLayer as HTMLElement).style.transform;

    // Drag the view somewhere else, then re-render with the same
    // focusRequest object/nonce (e.g. an unrelated parent re-render).
    // This must not snap the camera back.
    const viewport = container.querySelector(".overflow-hidden");
    if (!viewport) throw new Error("tree viewport not found");
    fireEvent.mouseDown(viewport, { button: 0, clientX: 100, clientY: 100 });
    fireEvent.mouseMove(window, { clientX: 140, clientY: 160, movementX: 40, movementY: 60 });
    fireEvent.mouseUp(window);
    const transformAfterDrag = (nodeLayer as HTMLElement).style.transform;
    expect(transformAfterDrag).not.toBe(transformAfterFirstJump);

    rerender(<QuestTreeView focusRequest={focusRequest} />);
    expect((nodeLayer as HTMLElement).style.transform).toBe(transformAfterDrag);
  });

  it("expands a still-collapsed chain to reach the requested task inside it, then highlights that specific part", async () => {
    const p1 = makeTask({ id: "signal-1", name: "Signal - Part 1" });
    const p2 = makeTask({
      id: "signal-2",
      name: "Signal - Part 2",
      taskRequirements: [{ task: { id: "signal-1" }, status: ["complete"] }],
    });
    const p3 = makeTask({
      id: "signal-3",
      name: "Signal - Part 3",
      taskRequirements: [{ task: { id: "signal-2" }, status: ["complete"] }],
    });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [p1, p2, p3] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    const { rerender } = renderWithQueryClient(<QuestTreeView focusRequest={null} />);
    await waitFor(() => {
      expect(screen.getByText("Signal")).toBeInTheDocument();
    });
    expect(screen.queryByText("Signal - Part 2")).not.toBeInTheDocument();

    rerender(<QuestTreeView focusRequest={{ taskId: "signal-2", nonce: 1 }} />);

    const part2Button = screen.getByText("Signal - Part 2").closest("button");
    if (!part2Button) throw new Error("part 2 button not found");
    expect(part2Button).toHaveClass("ring-4");
    // Sibling parts are visible now too (the whole chain expanded), but
    // only Part 2 itself is highlighted.
    const part1Button = screen.getByText("Signal - Part 1").closest("button");
    expect(part1Button).not.toHaveClass("ring-4");
  });

  it("jumps immediately on mount when it receives a focusRequest as an initial prop (QuestBoard switching tabs and requesting a focus in the same click)", async () => {
    const debut = makeTask({ id: "debut", name: "Debut" });
    const shootingCans = makeTask({ id: "cans", name: "Shooting Cans" });
    vi.mocked(fetchTarkovGameData).mockResolvedValue(makeRawData({ tasks: [debut, shootingCans] }));
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });

    renderWithQueryClient(<QuestTreeView focusRequest={{ taskId: "cans", nonce: 1 }} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Shooting Cans/ })).toHaveClass("ring-4");
    });
  });
});
