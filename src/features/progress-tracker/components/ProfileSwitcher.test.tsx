import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithQueryClient } from "@/test/render-with-providers";

import { useProgressTrackerStore } from "../store";

import { ProfileSwitcher } from "./ProfileSwitcher";

import type { ReactElement } from "react";

const initialState = useProgressTrackerStore.getInitialState();

// `ProfileSwitcher` always mounts `CharacterStatsDialog`, which calls
// `useTarkovGameData()` regardless of whether it's open (same
// always-mounted-behind-a-dialog pattern as `QuestBoard`'s
// `MapRecommendationDialog`), so every render here needs a `QueryClient`
// ancestor and a mocked fetch. A never-resolving promise is enough, since
// none of these tests assert on trader data.
vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(() => new Promise(() => undefined)),
}));

function render(ui: ReactElement) {
  return renderWithQueryClient(ui);
}

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
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "Nikita", mode: "PVP", faction: "BEAR", face: null });
    render(<ProfileSwitcher />);

    await user.click(screen.getByRole("button", { name: /Nikita/ }));
    await user.click(screen.getByRole("menuitem", { name: /Manage Profiles/ }));

    expect(screen.getByRole("dialog", { name: "Manage Profiles" })).toBeInTheDocument();
  });

  it("offers a 'Create Profile' item instead of 'Manage Profiles' when there are no profiles yet", async () => {
    const user = userEvent.setup();
    render(<ProfileSwitcher />);

    await user.click(screen.getByRole("button", { name: /No Profile/ }));

    expect(screen.queryByRole("menuitem", { name: /Manage Profiles/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: /Create Profile/ }));

    expect(screen.getByRole("dialog", { name: "Manage Profiles" })).toBeInTheDocument();
  });

  it("does not offer a 'Character Stats' item when there are no profiles yet", async () => {
    const user = userEvent.setup();
    render(<ProfileSwitcher />);

    await user.click(screen.getByRole("button", { name: /No Profile/ }));

    expect(screen.queryByRole("menuitem", { name: /Character Stats/ })).not.toBeInTheDocument();
  });

  it("opens the character stats dialog via the 'Character Stats' item", async () => {
    const user = userEvent.setup();
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "Nikita", mode: "PVP", faction: "BEAR", face: null });
    render(<ProfileSwitcher />);

    await user.click(screen.getByRole("button", { name: /Nikita/ }));
    await user.click(screen.getByRole("menuitem", { name: /Character Stats/ }));

    expect(screen.getByRole("dialog", { name: "Character Stats" })).toBeInTheDocument();
  });
});
