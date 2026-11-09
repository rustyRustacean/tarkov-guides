import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { useProgressTrackerStore } from "../store";

import { ModeSwitcher } from "./ModeSwitcher";

beforeEach(() => {
  useProgressTrackerStore.setState({
    profiles: [],
    activeProfileId: null,
    activeMode: "PVP",
    progressByProfile: {},
  });
});

describe("ModeSwitcher", () => {
  it("switches the site-wide mode with no profile", async () => {
    render(<ModeSwitcher />);
    await userEvent.click(screen.getByRole("radio", { name: "PvE" }));
    expect(useProgressTrackerStore.getState().activeMode).toBe("PVE");
    expect(screen.getByRole("radio", { name: "PvE" })).toHaveAttribute("aria-checked", "true");
  });

  it("switches straight to a mode the profile hasn't set up, without a setup dialog", async () => {
    const id = useProgressTrackerStore
      .getState()
      .createProfile({ name: "Main", face: null, mode: "PVP", faction: "USEC" });
    render(<ModeSwitcher />);

    await userEvent.click(screen.getByRole("radio", { name: "Seasonal" }));

    expect(useProgressTrackerStore.getState().activeMode).toBe("PVP_SEASONAL");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // No Seasonal character was fabricated; the tracker offers setup instead.
    expect(Object.keys(useProgressTrackerStore.getState().progressByProfile)).toEqual([
      `${id}:PVP`,
    ]);
  });
});
