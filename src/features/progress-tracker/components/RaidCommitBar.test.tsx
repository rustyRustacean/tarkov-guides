import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { useProgressTrackerStore } from "../store";

import { RaidCommitBar } from "./RaidCommitBar";

const initialState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
});

describe("RaidCommitBar", () => {
  it("renders nothing when there is no active profile", () => {
    const { container } = render(<RaidCommitBar />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows 'No pending items' and disables both buttons when pending is empty", () => {
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    render(<RaidCommitBar />);

    expect(screen.getByText("No pending items")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extracted" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Died" })).toBeDisabled();
  });

  it("shows the pending count and enables both buttons once something is pending", () => {
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setPending("item-a", 3);
    render(<RaidCommitBar />);

    expect(screen.getByText("3 pending items this raid")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Extracted" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Died" })).toBeEnabled();
  });

  it("clicking Extracted merges pending into have and clears pending", async () => {
    const user = userEvent.setup();
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setHave("item-a", 1);
    useProgressTrackerStore.getState().setPending("item-a", 3);
    render(<RaidCommitBar />);

    await user.click(screen.getByRole("button", { name: "Extracted" }));

    const progress = useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`];
    expect(progress?.have).toEqual({ "item-a": 4 });
    expect(progress?.pending).toEqual({});
  });

  it("clicking Died discards pending and leaves have untouched", async () => {
    const user = userEvent.setup();
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setHave("item-a", 1);
    useProgressTrackerStore.getState().setPending("item-a", 3);
    render(<RaidCommitBar />);

    await user.click(screen.getByRole("button", { name: "Died" }));

    const progress = useProgressTrackerStore.getState().progressByProfile[`${profileId}:PVP`];
    expect(progress?.have).toEqual({ "item-a": 1 });
    expect(progress?.pending).toEqual({});
  });
});
