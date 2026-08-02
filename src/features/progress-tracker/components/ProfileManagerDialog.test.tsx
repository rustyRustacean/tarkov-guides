import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProgressTrackerStore } from "../store";

import { ProfileManagerDialog } from "./ProfileManagerDialog";

const initialState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
});

function renderOpen() {
  const onOpenChange = vi.fn();
  render(<ProfileManagerDialog open onOpenChange={onOpenChange} />);
  return { onOpenChange };
}

describe("ProfileManagerDialog", () => {
  it("shows an empty-state message when there are no profiles yet", () => {
    renderOpen();
    expect(screen.getByText(/no profiles yet/i)).toBeInTheDocument();
  });

  it("creates a profile from the form, including faction", async () => {
    const user = userEvent.setup();
    renderOpen();

    await user.type(screen.getByLabelText("Name"), "Nikita");
    await user.click(screen.getByRole("radio", { name: "PVE" }));
    await user.click(screen.getByRole("radio", { name: "USEC" }));
    await user.click(screen.getByRole("button", { name: "Create Profile" }));

    const profile = useProgressTrackerStore.getState().profiles[0];
    expect(profile).toMatchObject({ name: "Nikita", mode: "PVE", faction: "USEC" });
  });

  it("closes the dialog after creating a profile", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderOpen();

    await user.type(screen.getByLabelText("Name"), "Nikita");
    await user.click(screen.getByRole("button", { name: "Create Profile" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the dialog open after editing a profile", async () => {
    const user = userEvent.setup();
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "Original", mode: "PVP", faction: "BEAR", face: null });
    const { onOpenChange } = renderOpen();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Renamed");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("does not create a profile with a blank/whitespace-only name", async () => {
    const user = userEvent.setup();
    renderOpen();
    await user.type(screen.getByLabelText("Name"), "   ");
    await user.click(screen.getByRole("button", { name: "Create Profile" }));
    expect(useProgressTrackerStore.getState().profiles).toHaveLength(0);
  });

  it("editing a profile omits the faction control and preserves the original faction", async () => {
    const user = userEvent.setup();
    const { createProfile } = useProgressTrackerStore.getState();
    const id = createProfile({ name: "Original", mode: "PVP", faction: "BEAR", face: null });
    renderOpen();

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.queryByText(/faction \(cannot be changed later\)/i)).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Renamed");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    const profile = useProgressTrackerStore.getState().profiles.find((p) => p.id === id);
    expect(profile).toMatchObject({ name: "Renamed", faction: "BEAR" });
  });

  it("deletes a profile only after the inline two-step confirm", async () => {
    const user = userEvent.setup();
    const { createProfile } = useProgressTrackerStore.getState();
    createProfile({ name: "ToDelete", mode: "PVP", faction: "BEAR", face: null });
    renderOpen();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(useProgressTrackerStore.getState().profiles).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(useProgressTrackerStore.getState().profiles).toHaveLength(0);
  });

  it("clicking Cancel on the delete confirm keeps the profile", async () => {
    const user = userEvent.setup();
    const { createProfile } = useProgressTrackerStore.getState();
    createProfile({ name: "Keep Me", mode: "PVP", faction: "BEAR", face: null });
    renderOpen();

    await user.click(screen.getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(useProgressTrackerStore.getState().profiles).toHaveLength(1);
  });
});
