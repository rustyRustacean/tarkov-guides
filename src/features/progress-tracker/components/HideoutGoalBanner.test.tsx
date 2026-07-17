import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HideoutGoalBanner } from "./HideoutGoalBanner";

import type { HideoutBuiltKey } from "../types";
import type { RawHideoutStation } from "@/shared/lib/tarkov-api/types";

const stationA: RawHideoutStation = {
  id: "station-a",
  name: "Workbench",
  normalizedName: "workbench",
  levels: [
    { level: 1, itemRequirements: [], stationLevelRequirements: [] },
    { level: 2, itemRequirements: [], stationLevelRequirements: [] },
  ],
};

describe("HideoutGoalBanner", () => {
  it("renders nothing when there is no goal", () => {
    const { container } = render(
      <HideoutGoalBanner goal={null} stations={[stationA]} hideoutBuilt={{}} onClear={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the done-state banner with a working CLEAR button when the goal is already built", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    const built: Record<HideoutBuiltKey, true> = { "workbench:1": true, "workbench:2": true };
    render(
      <HideoutGoalBanner
        goal={{ stationNormalizedName: "workbench", level: 2 }}
        stations={[stationA]}
        hideoutBuilt={built}
        onClear={onClear}
      />,
    );

    expect(screen.getByText("Goal complete: Workbench L2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledOnce();
  });

  it("shows the ordered step list (prereqs + final goal step) when unbuilt", () => {
    render(
      <HideoutGoalBanner
        goal={{ stationNormalizedName: "workbench", level: 2 }}
        stations={[stationA]}
        hideoutBuilt={{}}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText("Goal: Workbench L2")).toBeInTheDocument();
    expect(
      screen.getByText("1 prerequisite blocking · ordered shortest build path"),
    ).toBeInTheDocument();
    expect(screen.getByText("Workbench L1")).toBeInTheDocument();
    expect(screen.getByText(/★ Workbench L2/)).toBeInTheDocument();
  });
});
