import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchTarkovGameData } from "@/shared/lib/tarkov-api/fetch-tarkov-data";
import { renderWithQueryClient } from "@/test/render-with-providers";

import { defaultQuestFilters, QuestFilterBar } from "./QuestFilterBar";

import type { QuestFilters } from "./QuestFilterBar";

/**
 * `QuestFilterBar` is a controlled component (`value={filters.search}`) -
 * exercising a real keystroke-by-keystroke `user.type()` needs a stateful
 * wrapper that actually re-renders with the updated filters after each
 * change, the same way the real parent (`QuestList`) does. Without this,
 * the input's `value` prop never updates between keystrokes, so each
 * keystroke fires against the same stale starting value.
 */
function StatefulQuestFilterBar({
  onFiltersChange,
}: {
  onFiltersChange: (filters: QuestFilters) => void;
}) {
  const [filters, setFilters] = useState<QuestFilters>(defaultQuestFilters());
  return (
    <QuestFilterBar
      filters={filters}
      onFiltersChange={(next) => {
        setFilters(next);
        onFiltersChange(next);
      }}
      traderNames={[]}
    />
  );
}

vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(fetchTarkovGameData).mockResolvedValue({
    tasks: [],
    hideoutStations: [],
    items: [],
    itemsPve: [],
    maps: [],
    traders: [],
    barters: [],
    crafts: [],
  });
});

describe("QuestFilterBar", () => {
  it("calls onFiltersChange with the updated search text", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderWithQueryClient(<StatefulQuestFilterBar onFiltersChange={onFiltersChange} />);
    await user.type(screen.getByLabelText("Search quests"), "Debut");
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...defaultQuestFilters(), search: "Debut" });
  });

  it("lists every provided trader name as a select option", () => {
    renderWithQueryClient(
      <QuestFilterBar
        filters={defaultQuestFilters()}
        onFiltersChange={vi.fn()}
        traderNames={["Prapor", "Skier"]}
      />,
    );
    expect(screen.getByRole("option", { name: "Prapor" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Skier" })).toBeInTheDocument();
  });

  it("toggles kappaOnly, hideDone, and showLocked checkboxes", async () => {
    const user = userEvent.setup();
    const onFiltersChange = vi.fn();
    renderWithQueryClient(
      <QuestFilterBar
        filters={defaultQuestFilters()}
        onFiltersChange={onFiltersChange}
        traderNames={[]}
      />,
    );
    await user.click(screen.getByLabelText("Kappa only"));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...defaultQuestFilters(), kappaOnly: true });

    await user.click(screen.getByLabelText("Hide done"));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ ...defaultQuestFilters(), hideDone: true });

    await user.click(screen.getByLabelText("Show locked"));
    expect(onFiltersChange).toHaveBeenLastCalledWith({
      ...defaultQuestFilters(),
      showLocked: true,
    });
  });

  it("opens the Character Stats dialog", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <QuestFilterBar filters={defaultQuestFilters()} onFiltersChange={vi.fn()} traderNames={[]} />,
    );
    await user.click(screen.getByRole("button", { name: "Character Stats" }));
    expect(screen.getByRole("dialog", { name: "Character Stats" })).toBeInTheDocument();
  });
});
