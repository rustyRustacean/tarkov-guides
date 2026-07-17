import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { useProgressTrackerStore } from "../store";

import { ProfileSwitcher } from "./ProfileSwitcher";

const initialState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
});

describe("ProfileSwitcher", () => {
  it("shows 'No Profile' when nothing is active", () => {
    render(<ProfileSwitcher />);
    expect(screen.getByRole("button", { name: /No Profile/ })).toBeInTheDocument();
  });

  it("shows the active profile's name on the trigger", () => {
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "Nikita", mode: "PVP", faction: "BEAR", face: null });
    render(<ProfileSwitcher />);
    expect(screen.getByRole("button", { name: /Nikita/ })).toBeInTheDocument();
  });

  it("lists every profile as a checked-when-active radio item and switches on selection", async () => {
    const user = userEvent.setup();
    const { createProfile } = useProgressTrackerStore.getState();
    const a = createProfile({ name: "Profile A", mode: "PVP", faction: "BEAR", face: null });
    createProfile({ name: "Profile B", mode: "PVE", faction: "USEC", face: null });
    useProgressTrackerStore.getState().switchProfile(a);

    render(<ProfileSwitcher />);
    await user.click(screen.getByRole("button", { name: /Profile A/ }));

    expect(screen.getByRole("menuitemradio", { name: /Profile A/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await user.click(screen.getByRole("menuitemradio", { name: /Profile B/ }));
    expect(useProgressTrackerStore.getState().activeProfileId).toBe(
      useProgressTrackerStore.getState().profiles[1]?.id,
    );
  });

  it("opens the profile manager dialog via the 'Manage Profiles' item", async () => {
    const user = userEvent.setup();
    render(<ProfileSwitcher />);

    await user.click(screen.getByRole("button", { name: /No Profile/ }));
    await user.click(screen.getByRole("menuitem", { name: /Manage Profiles/ }));

    expect(screen.getByRole("dialog", { name: "Manage Profiles" })).toBeInTheDocument();
  });
});
