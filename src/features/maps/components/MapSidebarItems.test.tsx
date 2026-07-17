import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { MapSidebarItems } from "./MapSidebarItems";

import type { TrackedItem } from "@/features/progress-tracker/selectors/item-progress";

const initialState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
});

function makeItem(overrides: Partial<TrackedItem> = {}): TrackedItem {
  return {
    id: "item-a",
    name: "Item A",
    shortName: "A",
    iconLink: null,
    need: 5,
    have: 2,
    pending: 1,
    remaining: 3,
    foundInRaid: false,
    pinned: false,
    source: "task",
    isCustom: false,
    ...overrides,
  };
}

describe("MapSidebarItems", () => {
  it("shows the empty state when there are no items or custom items", () => {
    render(<MapSidebarItems items={[]} customItems={[]} mapDisplayName="Reserve" />);
    expect(screen.getByText(/No active items for Reserve/)).toBeInTheDocument();
  });

  it("renders item rows with need/have/remaining and an FIR badge", () => {
    const item = makeItem({ name: "Bolts", need: 5, have: 2, remaining: 3, foundInRaid: true });
    render(<MapSidebarItems items={[item]} customItems={[]} mapDisplayName="Reserve" />);
    expect(screen.getByText("Bolts")).toBeInTheDocument();
    expect(screen.getByText(/Need 5.*Have 2.*Remaining 3/)).toBeInTheDocument();
    expect(screen.getByText("FIR")).toBeInTheDocument();
  });

  it("renders a custom-items divider with a count only when there are custom items", () => {
    const { rerender } = render(
      <MapSidebarItems items={[makeItem()]} customItems={[]} mapDisplayName="Reserve" />,
    );
    expect(screen.queryByText("◆ Custom Items")).not.toBeInTheDocument();

    rerender(
      <MapSidebarItems
        items={[]}
        customItems={[makeItem({ id: "custom-1", name: "Custom Thing", source: "custom" })]}
        mapDisplayName="Reserve"
      />,
    );
    expect(screen.getByText("◆ Custom Items")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("Custom Thing")).toBeInTheDocument();
  });

  it("double-clicking a row toggles the item's pinned state via the progress-tracker store", () => {
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    const item = makeItem({ id: "item-a", name: "Bolts" });
    render(<MapSidebarItems items={[item]} customItems={[]} mapDisplayName="Reserve" />);

    const row = screen.getByRole("button", { name: /Bolts/ });
    row.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));

    expect(useProgressTrackerStore.getState().progressByProfile[profileId]?.pinnedItemIds).toEqual([
      "item-a",
    ]);
  });
});
