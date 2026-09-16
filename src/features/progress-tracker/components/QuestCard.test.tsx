import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { QuestCard } from "./QuestCard";

import type { QuestAvailability } from "../selectors/quest-availability";
import type { NormalizedTask } from "@/shared/lib/tarkov-api/types";

function makeTask(overrides: Partial<NormalizedTask> = {}): NormalizedTask {
  return {
    id: "task-1",
    name: "Debut",
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
    requiredPrestigeLevel: null,
    trader: { id: "prapor-id", name: "Prapor", imageLink: null },
    maps: [],
    taskRequirements: [],
    traderRequirements: [],
    objectives: [],
    failConditions: [],
    finishRewards: null,
    startRewards: null,
    failureOutcome: null,
    itemRequirements: [],
    ...overrides,
  };
}

function makeAvailability(overrides: Partial<QuestAvailability> = {}): QuestAvailability {
  return {
    taskId: "task-1",
    status: "notstarted",
    isAvailable: true,
    isLocked: false,
    unmetPrereqTaskIds: [],
    unmetTraderRequirements: [],
    delayedUnlock: null,
    factionMismatch: false,
    prestigeUnmet: false,
    ...overrides,
  };
}

function noop() {
  /* no-op */
}

describe("QuestCard", () => {
  it("renders the quest name, trader, and level", () => {
    render(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability()}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.getByText("Debut")).toBeInTheDocument();
    expect(screen.getByText(/Prapor/)).toBeInTheDocument();
    expect(screen.getByText(/Lv 1/)).toBeInTheDocument();
  });

  it("shows a Kappa badge only when the task requires it", () => {
    const { rerender } = render(
      <QuestCard
        task={makeTask({ kappaRequired: true })}
        availability={makeAvailability()}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.getByText("Kappa")).toBeInTheDocument();

    rerender(
      <QuestCard
        task={makeTask({ kappaRequired: false })}
        availability={makeAvailability()}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.queryByText("Kappa")).not.toBeInTheDocument();
  });

  it("shows an 'N behind' badge only when tasksBehindCount is greater than 0", () => {
    const { rerender } = render(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability()}
        pinned={false}
        tasksBehindCount={4}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.getByText("4 behind")).toBeInTheDocument();

    rerender(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability()}
        pinned={false}
        tasksBehindCount={0}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.queryByText(/behind/)).not.toBeInTheDocument();

    rerender(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability()}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.queryByText(/behind/)).not.toBeInTheDocument();
  });

  it("disables the Start button for a locked notstarted quest", () => {
    render(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability({ isAvailable: false, isLocked: true })}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });

  it("shows an ETA hint instead of a bare 'Locked' badge when the only unmet gate is the real-time delay", () => {
    render(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability({
          isAvailable: false,
          isLocked: true,
          delayedUnlock: {
            prereqTaskId: "signal-part-3",
            unlocksAtMin: new Date(Date.now() + 2 * 3_600_000).toISOString(),
            unlocksAtMax: new Date(Date.now() + 2.1 * 3_600_000).toISOString(),
          },
        })}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.getByText(/Locked - unlocks in ~2\.0-2\.1 hrs/)).toBeInTheDocument();
  });

  it("shows which faction a locked task is exclusive to, instead of a bare 'Locked' badge", () => {
    render(
      <QuestCard
        task={makeTask({ factionName: "BEAR" })}
        availability={makeAvailability({
          isAvailable: false,
          isLocked: true,
          factionMismatch: true,
        })}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.getByText("Locked - BEAR only")).toBeInTheDocument();
  });

  it("shows the required Prestige level for a Prestige-gated locked task, instead of a bare 'Locked' badge", () => {
    render(
      <QuestCard
        task={makeTask({ requiredPrestigeLevel: 3 })}
        availability={makeAvailability({ isAvailable: false, isLocked: true, prestigeUnmet: true })}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.getByText("Locked - requires Prestige 3")).toBeInTheDocument();
  });

  it("shows how many prerequisite quests are incomplete, instead of a bare 'Locked' badge", () => {
    render(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability({
          isAvailable: false,
          isLocked: true,
          unmetPrereqTaskIds: ["prereq-1", "prereq-2"],
        })}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.getByText("Locked - 2 prerequisite quests incomplete")).toBeInTheDocument();
  });

  it("shows a singular prerequisite count for exactly one incomplete prerequisite", () => {
    render(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability({
          isAvailable: false,
          isLocked: true,
          unmetPrereqTaskIds: ["prereq-1"],
        })}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.getByText("Locked - 1 prerequisite quest incomplete")).toBeInTheDocument();
  });

  it("shows the unmet trader requirement, instead of a bare 'Locked' badge", () => {
    render(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability({
          isAvailable: false,
          isLocked: true,
          unmetTraderRequirements: [
            {
              traderId: "prapor-id",
              traderName: "Prapor",
              requirementType: "level",
              compareMethod: ">=",
              value: 2,
            },
          ],
        })}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.getByText("Locked - Prapor loyalty level >= 2")).toBeInTheDocument();
  });

  it("shows a Lightkeeper badge only when the task counts toward Lightkeeper access", () => {
    const { rerender } = render(
      <QuestCard
        task={makeTask({ lightkeeperRequired: true })}
        availability={makeAvailability()}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.getByText("Lightkeeper")).toBeInTheDocument();

    rerender(
      <QuestCard
        task={makeTask({ lightkeeperRequired: false })}
        availability={makeAvailability()}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.queryByText("Lightkeeper")).not.toBeInTheDocument();
  });

  it("calls onStart when Start is clicked on an available quest", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability({ isAvailable: true })}
        pinned={false}
        onStart={onStart}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Start" }));
    expect(onStart).toHaveBeenCalledWith("task-1");
  });

  it("shows Complete/Fail buttons for an inprog quest", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    const onFail = vi.fn();
    render(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability({ status: "inprog" })}
        pinned={false}
        onStart={noop}
        onDone={onDone}
        onFail={onFail}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Complete" }));
    expect(onDone).toHaveBeenCalledWith("task-1");
    await user.click(screen.getByRole("button", { name: "Fail" }));
    expect(onFail).toHaveBeenCalledWith("task-1");
  });

  it("shows an Undo button for a done or failed quest", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability({ status: "done" })}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={onUndo}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledWith("task-1");
  });

  it("calls onOpenDetail when the name/description area is clicked - regression test for M-3 (List/Trader views had no way to open quest detail)", async () => {
    const user = userEvent.setup();
    const onOpenDetail = vi.fn();
    render(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability()}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={onOpenDetail}
      />,
    );
    await user.click(screen.getByText("Debut"));
    expect(onOpenDetail).toHaveBeenCalledWith("task-1");
  });

  it("toggles pin via a real, single-click, keyboard-reachable button - regression test for a keyboard-accessibility gap", async () => {
    const user = userEvent.setup();
    const onTogglePin = vi.fn();
    const { rerender } = render(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability()}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={onTogglePin}
        onOpenDetail={noop}
      />,
    );
    const pinButton = screen.getByRole("button", { name: "Pin Debut" });
    expect(pinButton).toHaveAttribute("aria-pressed", "false");

    await user.click(pinButton);
    expect(onTogglePin).toHaveBeenCalledWith("task-1");

    rerender(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability()}
        pinned
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={onTogglePin}
        onOpenDetail={noop}
      />,
    );
    expect(screen.getByRole("button", { name: "Unpin Debut" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("hides the trader avatar and name, but keeps the level, when showTrader is false", () => {
    const { container } = render(
      <QuestCard
        task={makeTask({
          trader: {
            id: "prapor-id",
            name: "Prapor",
            imageLink: "https://assets.tarkov.dev/prapor.png",
          },
        })}
        availability={makeAvailability()}
        pinned={false}
        showTrader={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(screen.queryByText(/Prapor/)).not.toBeInTheDocument();
    expect(screen.getByText("Lv 1")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("renders the trader's avatar image when imageLink is set, and a fallback circle when it isn't (default showTrader)", () => {
    const { container, rerender } = render(
      <QuestCard
        task={makeTask()}
        availability={makeAvailability()}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(container.querySelector("img")).not.toBeInTheDocument();

    rerender(
      <QuestCard
        task={makeTask({
          trader: {
            id: "prapor-id",
            name: "Prapor",
            imageLink: "https://assets.tarkov.dev/prapor.png",
          },
        })}
        availability={makeAvailability()}
        pinned={false}
        onStart={noop}
        onDone={noop}
        onFail={noop}
        onUndo={noop}
        onTogglePin={noop}
        onOpenDetail={noop}
      />,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://assets.tarkov.dev/prapor.png",
    );
  });
});
