import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { submitSessionToken } from "../../session/join-session";

import { SessionEntryDialog } from "./SessionEntryDialog";

vi.mock("../../session/join-session", () => ({
  submitSessionToken: vi.fn(),
}));

vi.mock("@/features/progress-tracker/store", () => ({
  useProgressTrackerStore: (selector: (state: unknown) => unknown) =>
    selector({ profiles: [], activeProfileId: null }),
}));

describe("SessionEntryDialog", () => {
  beforeEach(() => {
    vi.mocked(submitSessionToken).mockReset();
  });

  it("Start Hosting is disabled until a display name is entered", async () => {
    render(<SessionEntryDialog open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Start Hosting" })).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Your name"), "Alice");
    expect(screen.getByRole("button", { name: "Start Hosting" })).toBeEnabled();
  });

  it("hosting calls submitSessionToken with mode host and closes on success", async () => {
    vi.mocked(submitSessionToken).mockResolvedValue({ ok: true });
    const onOpenChange = vi.fn();
    render(<SessionEntryDialog open={true} onOpenChange={onOpenChange} />);

    await userEvent.type(screen.getByLabelText("Your name"), "Alice");
    await userEvent.click(screen.getByRole("button", { name: "Start Hosting" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(submitSessionToken).toHaveBeenCalledWith("host", expect.any(String), "Alice");
  });

  it("shows the server's error reason and re-enables the button on failure", async () => {
    vi.mocked(submitSessionToken).mockResolvedValue({ ok: false, reason: "That code is taken." });
    render(<SessionEntryDialog open={true} onOpenChange={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Your name"), "Alice");
    await userEvent.click(screen.getByRole("button", { name: "Start Hosting" }));

    await screen.findByText("That code is taken.");
    expect(screen.getByRole("button", { name: "Start Hosting" })).toBeEnabled();
  });

  it("disables Start Hosting for an invalid custom word", async () => {
    render(<SessionEntryDialog open={true} onOpenChange={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Your name"), "Alice");
    await userEvent.click(screen.getByText("Use my own word"));
    await userEvent.type(screen.getByLabelText("Custom join word"), "ab");

    expect(screen.getByRole("button", { name: "Start Hosting" })).toBeDisabled();
    expect(screen.getByText(/at least/i)).toBeInTheDocument();
  });

  it("pre-fills the Join tab and code when initialJoinCode is provided", () => {
    render(
      <SessionEntryDialog open={true} onOpenChange={vi.fn()} initialJoinCode="silent-scav-42" />,
    );
    expect(screen.getByLabelText("Join code")).toHaveValue("silent-scav-42");
  });

  it("joining calls submitSessionToken with mode join", async () => {
    vi.mocked(submitSessionToken).mockResolvedValue({ ok: true });
    const onOpenChange = vi.fn();
    render(
      <SessionEntryDialog
        open={true}
        onOpenChange={onOpenChange}
        initialJoinCode="silent-scav-42"
      />,
    );

    await userEvent.type(screen.getByLabelText("Your name"), "Bob");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(submitSessionToken).toHaveBeenCalledWith("join", "silent-scav-42", "Bob");
  });
});
