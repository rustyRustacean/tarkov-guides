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
    expect(link).toHaveAttribute("href", "/companion/MasterTarkov-Companion-Setup.bat");
    await waitFor(() => {
      expect(screen.getByText("Not running")).toBeInTheDocument();
    });
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
    expect(screen.getByText(/PvE · USEC/)).toBeInTheDocument();
    expect(screen.getByText("7 done / 3 active")).toBeInTheDocument();
  });

  it("persists the auto-launch toggle", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const user = userEvent.setup();
    renderWithQueryClient(<CompanionButton />);

    await user.click(screen.getByRole("button", { name: "EFT Companion" }));
    const checkbox = await screen.findByRole("checkbox", { name: /launch automatically/i });
    await user.click(checkbox);

    expect(localStorage.getItem(COMPANION_AUTOLAUNCH_KEY)).toBe("1");
  });
});
