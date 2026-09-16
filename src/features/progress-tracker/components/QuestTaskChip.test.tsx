import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { QuestTaskChip } from "./QuestTaskChip";

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

describe("QuestTaskChip", () => {
  it("renders the task name and level", () => {
    render(
      <QuestTaskChip
        task={makeTask()}
        availability={makeAvailability()}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("Debut")).toBeInTheDocument();
    expect(screen.getByText("Lv 1")).toBeInTheDocument();
  });

  it("calls onSelect with the task id when clicked", async () => {
    const onSelect = vi.fn();
    render(
      <QuestTaskChip
        task={makeTask()}
        availability={makeAvailability()}
        selected={false}
        onSelect={onSelect}
      />,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenCalledWith("task-1");
  });

  it("shows the kappa badge only when task.kappaRequired is true", () => {
    const { rerender } = render(
      <QuestTaskChip
        task={makeTask()}
        availability={makeAvailability()}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByTitle("Required for Kappa")).not.toBeInTheDocument();

    rerender(
      <QuestTaskChip
        task={makeTask({ kappaRequired: true })}
        availability={makeAvailability()}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTitle("Required for Kappa")).toBeInTheDocument();
  });

  it("shows the hidden-requirement badge only when task.hasHiddenRequirement is true", () => {
    const { rerender } = render(
      <QuestTaskChip
        task={makeTask()}
        availability={makeAvailability()}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByTitle(/Hidden unlock condition/)).not.toBeInTheDocument();

    rerender(
      <QuestTaskChip
        task={makeTask({ hasHiddenRequirement: true })}
        availability={makeAvailability()}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTitle(/Hidden unlock condition/)).toBeInTheDocument();
  });

  it("applies the done status class when the task is complete", () => {
    render(
      <QuestTaskChip
        task={makeTask()}
        availability={makeAvailability({ status: "done" })}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button")).toHaveClass("border-status-green");
  });

  it("applies the locked status class with no availability entry", () => {
    render(
      <QuestTaskChip
        task={makeTask()}
        availability={undefined}
        selected={false}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button")).toHaveClass("bg-muted/40");
  });

  it("applies a selection ring when selected", () => {
    render(
      <QuestTaskChip
        task={makeTask()}
        availability={makeAvailability()}
        selected={true}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button")).toHaveClass("ring-2");
  });
});
