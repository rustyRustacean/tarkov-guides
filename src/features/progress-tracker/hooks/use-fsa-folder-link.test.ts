import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useToastStore } from "@/shared/ui/toast/toast-store";

import {
  fsaFolderAdapter,
  getLinkStatus,
  pickAndLink,
  requestReconnect,
  resolveConflict,
  unlink,
} from "../persistence/fsa-folder-adapter";
import { useProgressTrackerStore } from "../store";

import { useFsaFolderLink } from "./use-fsa-folder-link";

import type { ProgressTrackerSnapshot } from "../persistence/types";

vi.mock("../persistence/fsa-folder-adapter", () => ({
  fsaFolderAdapter: { isAvailable: vi.fn(() => true) },
  getLinkStatus: vi.fn(),
  pickAndLink: vi.fn(),
  resolveConflict: vi.fn(),
  unlink: vi.fn(),
  requestReconnect: vi.fn(),
}));

const initialState = useProgressTrackerStore.getInitialState();

function makeSnapshot(overrides: Partial<ProgressTrackerSnapshot> = {}): ProgressTrackerSnapshot {
  return {
    schemaVersion: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    profiles: [],
    activeProfileId: null,
    activeMode: "PVP",
    progressByProfile: {},
    autoStartNext: true,
    ...overrides,
  };
}

beforeEach(() => {
  useProgressTrackerStore.setState(initialState, true);
  useToastStore.setState({ toast: null });
  vi.mocked(getLinkStatus).mockResolvedValue(null);
});

describe("useFsaFolderLink", () => {
  it("loads status on mount", async () => {
    vi.mocked(getLinkStatus).mockResolvedValue({ name: "MyBackups", permission: "granted" });

    const { result } = renderHook(() => useFsaFolderLink());
    await waitFor(() => {
      expect(result.current.status).toEqual({ name: "MyBackups", permission: "granted" });
    });
  });

  it("link() with a 'linked' result refreshes status and toasts", async () => {
    vi.mocked(pickAndLink).mockResolvedValue({ status: "linked" });
    vi.mocked(getLinkStatus).mockResolvedValue({ name: "MyBackups", permission: "granted" });

    const { result } = renderHook(() => useFsaFolderLink());
    await act(async () => {
      await result.current.link();
    });

    expect(result.current.status).toEqual({ name: "MyBackups", permission: "granted" });
    expect(useToastStore.getState().toast?.message).toBe("Backup folder linked");
  });

  it("link() with a 'restored' result hydrates the store and toasts", async () => {
    const snapshot = makeSnapshot({ activeProfileId: "restored-profile" });
    vi.mocked(pickAndLink).mockResolvedValue({ status: "restored", snapshot });

    const { result } = renderHook(() => useFsaFolderLink());
    await act(async () => {
      await result.current.link();
    });

    expect(useProgressTrackerStore.getState().activeProfileId).toBe("restored-profile");
    expect(useToastStore.getState().toast?.message).toContain("restored");
  });

  it("link() with a 'conflict' result sets pendingConflict without hydrating", async () => {
    const folderSnapshot = makeSnapshot({ activeProfileId: "folder-profile" });
    vi.mocked(pickAndLink).mockResolvedValue({ status: "conflict", folderSnapshot });

    const { result } = renderHook(() => useFsaFolderLink());
    await act(async () => {
      await result.current.link();
    });

    expect(result.current.pendingConflict).toEqual(folderSnapshot);
    expect(useProgressTrackerStore.getState().activeProfileId).toBeNull();
  });

  it("link() with a 'cancelled' result is a no-op", async () => {
    vi.mocked(pickAndLink).mockResolvedValue({ status: "cancelled" });

    const { result } = renderHook(() => useFsaFolderLink());
    await act(async () => {
      await result.current.link();
    });

    expect(result.current.pendingConflict).toBeNull();
    expect(useToastStore.getState().toast).toBeNull();
  });

  it("resolveConflict('replace') hydrates the store, clears pendingConflict, and toasts", async () => {
    const folderSnapshot = makeSnapshot({ activeProfileId: "folder-profile" });
    vi.mocked(pickAndLink).mockResolvedValue({ status: "conflict", folderSnapshot });
    vi.mocked(resolveConflict).mockResolvedValue(folderSnapshot);

    const { result } = renderHook(() => useFsaFolderLink());
    await act(async () => {
      await result.current.link();
    });
    await act(async () => {
      await result.current.resolveConflict("replace");
    });

    expect(result.current.pendingConflict).toBeNull();
    expect(useProgressTrackerStore.getState().activeProfileId).toBe("folder-profile");
    expect(useToastStore.getState().toast?.message).toContain("Replaced");
  });

  it("resolveConflict('keep-local') does not hydrate and toasts accordingly", async () => {
    const folderSnapshot = makeSnapshot({ activeProfileId: "folder-profile" });
    vi.mocked(pickAndLink).mockResolvedValue({ status: "conflict", folderSnapshot });
    vi.mocked(resolveConflict).mockResolvedValue(null);

    const { result } = renderHook(() => useFsaFolderLink());
    await act(async () => {
      await result.current.link();
    });
    await act(async () => {
      await result.current.resolveConflict("keep-local");
    });

    expect(result.current.pendingConflict).toBeNull();
    expect(useProgressTrackerStore.getState().activeProfileId).toBeNull();
    expect(useToastStore.getState().toast?.message).toContain("Kept local");
  });

  it("unlinkFolder() clears status and toasts", async () => {
    vi.mocked(getLinkStatus).mockResolvedValue({ name: "MyBackups", permission: "granted" });
    vi.mocked(unlink).mockResolvedValue(undefined);

    const { result } = renderHook(() => useFsaFolderLink());
    await waitFor(() => {
      expect(result.current.status).not.toBeNull();
    });

    await act(async () => {
      await result.current.unlinkFolder();
    });

    expect(result.current.status).toBeNull();
    expect(useToastStore.getState().toast?.message).toBe("Backup folder unlinked");
  });

  it("reconnect() refreshes status and toasts success when granted", async () => {
    vi.mocked(requestReconnect).mockResolvedValue(true);
    vi.mocked(getLinkStatus).mockResolvedValue({ name: "MyBackups", permission: "granted" });

    const { result } = renderHook(() => useFsaFolderLink());
    await act(async () => {
      await result.current.reconnect();
    });

    expect(result.current.status?.permission).toBe("granted");
    expect(useToastStore.getState().toast?.message).toBe("Reconnected to backup folder");
  });

  it("reconnect() toasts failure when not granted", async () => {
    vi.mocked(requestReconnect).mockResolvedValue(false);

    const { result } = renderHook(() => useFsaFolderLink());
    await act(async () => {
      await result.current.reconnect();
    });

    expect(useToastStore.getState().toast?.message).toBe("Reconnect failed");
  });

  it("reflects fsaFolderAdapter.isAvailable() as isSupported", () => {
    vi.mocked(fsaFolderAdapter.isAvailable).mockReturnValue(false);
    const { result } = renderHook(() => useFsaFolderLink());
    expect(result.current.isSupported).toBe(false);
  });
});
