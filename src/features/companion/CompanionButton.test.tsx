import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithQueryClient } from "@/test/render-with-providers";

import { COMPANION_AUTOLAUNCH_KEY, type CompanionStatus } from "./companion-config";
import { CompanionButton } from "./CompanionButton";

function connectedStatus(overrides: Partial<CompanionStatus> = {}): CompanionStatus {
  return {
    app: "MasterTarkov-Companion",
    version: "1.0.0",
    running: true,
    session: "log_2026.08.01",
    gameVersion: "1.0.6.5.46221",
    mode: "pve",
    profileId: "p1",
    faction: "USEC",
    questsAvailable: true,
    quests: {},
    questCounts: { started: 3, finished: 7, failed: 0 },
    position: null,
    positionRevision: 0,
    revision: 1,
    updatedAt: 0,
    ...overrides,
  };
}

describe("CompanionButton", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders a header trigger", () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    renderWithQueryClient(<CompanionButton />);
    expect(screen.getByRole("button", { name: "EFT Companion" })).toBeInTheDocument();
  });

  it("opens the panel with download + setup when the companion is not running", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const user = userEvent.setup();
    renderWithQueryClient(<CompanionButton />);

    await user.click(screen.getByRole("button", { name: "EFT Companion" }));

    const link = await screen.findByRole("link", { name: /download/i });
    expect(link).toHaveAttribute("href", "/companion/MasterTarkovCompanion.zip");
    // The command is shown, not hidden behind a button: being able to read
    // what you're about to run is the entire reason this replaced an .exe.
    expect(
      screen.getByText("powershell -NoProfile -ExecutionPolicy Bypass -File .\\install.ps1"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /read the script/i })).toHaveAttribute(
      "href",
      "/companion/source",
    );
    await waitFor(() => {
      expect(screen.getByText("Not running")).toBeInTheDocument();
    });
  });

  it("keeps the source link visible once the companion is connected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(connectedStatus()) }),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<CompanionButton />);

    await user.click(screen.getByRole("button", { name: "EFT Companion" }));

    // It used to live in the not-running panel only, so connecting hid it - the
    // code was readable only by people who hadn't run it yet.
    expect(await screen.findByText("Connected")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /read the script/i })).toHaveAttribute(
      "href",
      "/companion/source",
    );
  });

  it("puts the download ahead of the steps, and gives the command a labelled Copy button", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const user = userEvent.setup();
    renderWithQueryClient(<CompanionButton />);

    await user.click(screen.getByRole("button", { name: "EFT Companion" }));

    // Step 1 is "get the file", so the button has to come before the list -
    // under it, you read the steps then hunt back down the panel for it.
    const download = await screen.findByRole("link", { name: /download the zip/i });
    // First list in the panel is the install steps; the second is the
    // troubleshooting list inside the collapsed "it IS running" section.
    const [steps] = screen.getAllByRole("list");
    if (!steps) throw new Error("expected the install steps list to render");
    expect(download.compareDocumentPosition(steps)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    // The whole install hangs off this one control, so it says "Copy" rather
    // than being a bare icon in a wall of monospace.
    const copy = screen.getByRole("button", { name: "Copy the install command" });
    expect(copy).toHaveTextContent("Copy");

    // "Start it" only does anything once installed, so it sits with the
    // troubleshooting line, not beside the download.
    expect(screen.getByRole("button", { name: "Start it" })).toBeInTheDocument();
  });

  it("shows live status when the companion is connected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(connectedStatus()) }),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<CompanionButton />);

    await user.click(screen.getByRole("button", { name: "EFT Companion" }));

    expect(await screen.findByText("Connected")).toBeInTheDocument();
    // The download stays reachable while it's running - that's when you need it,
    // because updating is "download again, re-run install.ps1".
    expect(screen.getByRole("link", { name: /download the zip/i })).toHaveAttribute(
      "href",
      "/companion/MasterTarkovCompanion.zip",
    );
    expect(screen.getByText("v1.0.0")).toBeInTheDocument();
    expect(screen.getByText(/PvE · USEC/)).toBeInTheDocument();
    expect(screen.getByText("7 done / 3 active")).toBeInTheDocument();
  });

  it("persists the auto-launch toggle", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const user = userEvent.setup();
    renderWithQueryClient(<CompanionButton />);

    await user.click(screen.getByRole("button", { name: "EFT Companion" }));
    const checkbox = await screen.findByRole("checkbox", { name: /launch automatically/i });
    // Off by default, so the first click is an opt-in.
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(localStorage.getItem(COMPANION_AUTOLAUNCH_KEY)).toBe("1");

    await user.click(checkbox);
    expect(localStorage.getItem(COMPANION_AUTOLAUNCH_KEY)).toBe("0");
  });
});
