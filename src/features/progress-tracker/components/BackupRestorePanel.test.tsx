import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fsaFolderAdapter,
  getLinkStatus,
  pickAndLink,
  resolveConflict,
} from "../persistence/fsa-folder-adapter";
import { manualJsonAdapter } from "../persistence/manual-json-adapter";
import { useProgressTrackerStore } from "../store";

import { BackupRestorePanel } from "./BackupRestorePanel";

vi.mock("../persistence/fsa-folder-adapter", () => ({
  fsaFolderAdapter: { isAvailable: vi.fn(() => false) },
  getLinkStatus: vi.fn(),
  pickAndLink: vi.fn(),
  resolveConflict: vi.fn(),
  unlink: vi.fn(),
  requestReconnect: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
  vi.mocked(getLinkStatus).mockResolvedValue(null);
  vi.mocked(fsaFolderAdapter.isAvailable).mockReturnValue(false);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("BackupRestorePanel", () => {
  it("renders Export/Import/Wipe controls", () => {
    render(<BackupRestorePanel />);
    expect(screen.getByRole("button", { name: "Export Backup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Backup" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wipe Progress" })).toBeInTheDocument();
  });

  it("Wipe Progress is disabled when there is no active profile", () => {
    render(<BackupRestorePanel />);
    expect(screen.getByRole("button", { name: "Wipe Progress" })).toBeDisabled();
  });

  it("clicking Export calls through to the adapter", async () => {
    const writeSpy = vi.spyOn(manualJsonAdapter, "write").mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<BackupRestorePanel />);

    await user.click(screen.getByRole("button", { name: "Export Backup" }));
    expect(writeSpy).toHaveBeenCalledOnce();
  });

  it("Wipe dialog: Cancel leaves progress untouched", async () => {
    const user = userEvent.setup();
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setHave("item-a", 5);

    render(<BackupRestorePanel />);
    await user.click(screen.getByRole("button", { name: "Wipe Progress" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(useProgressTrackerStore.getState().progressByProfile[profileId]?.have).toEqual({
      "item-a": 5,
    });
  });

  it("Wipe dialog: Confirm wipes progress and closes the dialog", async () => {
    const user = userEvent.setup();
    const profileId = useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setHave("item-a", 5);

    render(<BackupRestorePanel />);
    await user.click(screen.getByRole("button", { name: "Wipe Progress" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm Wipe" }));

    expect(useProgressTrackerStore.getState().progressByProfile[profileId]?.have).toEqual({});
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Clear All Data: Confirm removes every profile and the stored keys", async () => {
    const user = userEvent.setup();
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    useProgressTrackerStore.getState().setHave("item-a", 5);
    window.localStorage.setItem("tarkovguides.progress-tracker.v1", "{}");
    window.localStorage.setItem("tg.companion.profilemap", "{}");
    // Not progress - clearing tasks must not cost someone their map drawings.
    window.localStorage.setItem("tarkovguides.maps.v1", "{}");

    render(<BackupRestorePanel />);
    await user.click(screen.getByRole("button", { name: "Clear All Data" }));
    await user.click(screen.getByRole("button", { name: "Clear Everything" }));

    expect(useProgressTrackerStore.getState().profiles).toEqual([]);
    expect(useProgressTrackerStore.getState().activeProfileId).toBeNull();
    expect(useProgressTrackerStore.getState().progressByProfile).toEqual({});
    expect(window.localStorage.getItem("tarkovguides.progress-tracker.v1")).toBeNull();
    expect(window.localStorage.getItem("tg.companion.profilemap")).toBeNull();
    expect(window.localStorage.getItem("tarkovguides.maps.v1")).toBe("{}");
  });

  it("Clear All Data: Cancel leaves everything alone", async () => {
    const user = userEvent.setup();
    useProgressTrackerStore
      .getState()
      .createProfile({ name: "PMC", mode: "PVP", faction: "BEAR", face: null });
    window.localStorage.setItem("tarkovguides.progress-tracker.v1", "{}");

    render(<BackupRestorePanel />);
    await user.click(screen.getByRole("button", { name: "Clear All Data" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(useProgressTrackerStore.getState().profiles).toHaveLength(1);
    expect(window.localStorage.getItem("tarkovguides.progress-tracker.v1")).toBe("{}");
  });

  it("Import dialog: Confirm replaces store state via hydrate", async () => {
    const snapshot = {
      schemaVersion: 1 as const,
      exportedAt: "2026-01-01T00:00:00.000Z",
      profiles: [
        { id: "p1", name: "Imported", mode: "PVP" as const, faction: "BEAR" as const, face: null },
      ],
      activeProfileId: "p1",
      progressByProfile: {},
      autoStartNext: true,
    };
    vi.spyOn(manualJsonAdapter, "read").mockResolvedValue(snapshot);
    const user = userEvent.setup();

    render(<BackupRestorePanel />);
    await user.click(screen.getByRole("button", { name: "Import Backup" }));
    await user.click(screen.getByRole("button", { name: /Choose File & Replace/ }));

    expect(useProgressTrackerStore.getState().profiles).toEqual(snapshot.profiles);
  });

  it("Link Backup Folder control is absent when the FSA API isn't supported", () => {
    render(<BackupRestorePanel />);
    expect(screen.queryByRole("button", { name: /Link Backup Folder/ })).not.toBeInTheDocument();
  });

  it("Link Backup Folder control is present when the FSA API is supported", () => {
    vi.mocked(fsaFolderAdapter.isAvailable).mockReturnValue(true);
    render(<BackupRestorePanel />);
    expect(screen.getByRole("button", { name: "Link Backup Folder" })).toBeInTheDocument();
  });

  it("shows linked status and an Unlink button once a folder is linked", async () => {
    vi.mocked(fsaFolderAdapter.isAvailable).mockReturnValue(true);
    vi.mocked(getLinkStatus).mockResolvedValue({ name: "MyBackups", permission: "granted" });

    render(<BackupRestorePanel />);

    await waitFor(() => {
      expect(screen.getByText(/MyBackups/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "Unlink" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reconnect" })).not.toBeInTheDocument();
  });

  it("shows a Reconnect button when permission has reverted to prompt", async () => {
    vi.mocked(fsaFolderAdapter.isAvailable).mockReturnValue(true);
    vi.mocked(getLinkStatus).mockResolvedValue({ name: "MyBackups", permission: "prompt" });

    render(<BackupRestorePanel />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reconnect" })).toBeInTheDocument();
    });
  });

  it("Link dialog: Choose Folder calls pickAndLink and refreshes to the linked status", async () => {
    vi.mocked(fsaFolderAdapter.isAvailable).mockReturnValue(true);
    vi.mocked(getLinkStatus)
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ name: "MyBackups", permission: "granted" });
    vi.mocked(pickAndLink).mockResolvedValue({ status: "linked" });
    const user = userEvent.setup();

    render(<BackupRestorePanel />);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Link Backup Folder" })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Link Backup Folder" }));
    await user.click(screen.getByRole("button", { name: "Choose Folder" }));

    expect(pickAndLink).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(screen.getByText(/MyBackups/)).toBeInTheDocument();
    });
  });

  it("shows the conflict dialog and resolves it via Replace/Keep-local", async () => {
    vi.mocked(fsaFolderAdapter.isAvailable).mockReturnValue(true);
    const folderSnapshot = {
      schemaVersion: 1 as const,
      exportedAt: "2026-01-01T00:00:00.000Z",
      profiles: [
        {
          id: "p1",
          name: "FolderProfile",
          mode: "PVP" as const,
          faction: "BEAR" as const,
          face: null,
        },
      ],
      activeProfileId: "p1",
      progressByProfile: {},
      autoStartNext: true,
    };
    vi.mocked(pickAndLink).mockResolvedValue({ status: "conflict", folderSnapshot });
    vi.mocked(resolveConflict).mockResolvedValue(folderSnapshot);
    const user = userEvent.setup();

    render(<BackupRestorePanel />);
    await user.click(screen.getByRole("button", { name: "Link Backup Folder" }));
    await user.click(screen.getByRole("button", { name: "Choose Folder" }));

    expect(screen.getByText("Backup folder conflict")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Replace With Folder/ }));

    expect(useProgressTrackerStore.getState().profiles).toEqual(folderSnapshot.profiles);
    expect(screen.queryByText("Backup folder conflict")).not.toBeInTheDocument();
  });
});
