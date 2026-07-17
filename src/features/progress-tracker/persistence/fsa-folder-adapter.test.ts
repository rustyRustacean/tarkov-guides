import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  fsaFolderAdapter,
  getLinkStatus,
  pickAndLink,
  requestReconnect,
  resolveConflict,
  unlink,
} from "./fsa-folder-adapter";
import { idbDel, idbGet, idbPut } from "./idb";

import type { ProgressTrackerSnapshot } from "./types";

// `idb.ts` stores the real `FileSystemDirectoryHandle` via IndexedDB's
// structured-clone algorithm in production, which browsers special-case to
// support - a plain JS mock object with function properties (as needed
// here to stand in for `getFileHandle`/`queryPermission`/etc.) is NOT
// structured-clone-safe, so real (or fake-indexeddb-backed) IndexedDB would
// reject it. `idb.ts`'s own real IndexedDB round-trip behavior is already
// covered by `idb.test.ts`; this file mocks it out and focuses purely on
// `fsa-folder-adapter.ts`'s logic (permission handling, conflict
// detection, read/write) against a fake handle kept in a plain variable.
vi.mock("./idb", () => ({
  idbGet: vi.fn(),
  idbPut: vi.fn(),
  idbDel: vi.fn(),
}));

function makeSnapshot(overrides: Partial<ProgressTrackerSnapshot> = {}): ProgressTrackerSnapshot {
  return {
    schemaVersion: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    profiles: [],
    activeProfileId: null,
    progressByProfile: {},
    autoStartNext: true,
    ...overrides,
  };
}

function makeFakeHandle(name = "MyBackups") {
  const files = new Map<string, string>();
  let permission: PermissionState = "granted";

  const handle = {
    name,
    kind: "directory" as const,
    queryPermission: vi.fn(() => Promise.resolve(permission)),
    requestPermission: vi.fn(() => Promise.resolve(permission)),
    getFileHandle: vi.fn((fileName: string, options?: { create?: boolean }) => {
      if (!files.has(fileName)) {
        if (!options?.create) {
          const error = new Error("A requested file or directory could not be found");
          error.name = "NotFoundError";
          return Promise.reject(error);
        }
        files.set(fileName, "");
      }
      return Promise.resolve({
        name: fileName,
        kind: "file" as const,
        getFile: () =>
          Promise.resolve({
            text: () => Promise.resolve(files.get(fileName) ?? ""),
          }),
        createWritable: () =>
          Promise.resolve({
            write: (data: string) => {
              files.set(fileName, data);
              return Promise.resolve();
            },
            close: () => Promise.resolve(),
          }),
      });
    }),
  };

  return {
    handle: handle as unknown as FileSystemDirectoryHandle,
    files,
    setPermission: (next: PermissionState) => {
      permission = next;
    },
  };
}

beforeEach(() => {
  vi.mocked(idbGet).mockResolvedValue(undefined);
  vi.mocked(idbPut).mockResolvedValue(undefined);
  vi.mocked(idbDel).mockResolvedValue(undefined);
});

afterEach(async () => {
  // Clears the module-level cached handle between tests (a real singleton
  // in production, scoped to one page session - must be reset here since
  // the module isn't reloaded between test cases in the same file).
  await unlink();
  vi.clearAllMocks();
  Reflect.deleteProperty(window, "showDirectoryPicker");
});

describe("fsa-folder-adapter", () => {
  describe("getLinkStatus", () => {
    it("resolves null when nothing is linked", async () => {
      await expect(getLinkStatus()).resolves.toBeNull();
    });

    it("resolves the folder name and permission without ever calling requestPermission", async () => {
      const { handle, setPermission } = makeFakeHandle("MyBackups");
      setPermission("prompt");
      vi.mocked(idbGet).mockResolvedValue(handle);

      await expect(getLinkStatus()).resolves.toEqual({ name: "MyBackups", permission: "prompt" });
      expect(handle.requestPermission).not.toHaveBeenCalled();
    });
  });

  describe("pickAndLink", () => {
    it("writes the local snapshot immediately and returns 'linked' when the folder has no existing backup", async () => {
      const { handle, files } = makeFakeHandle();
      window.showDirectoryPicker = vi.fn().mockResolvedValue(handle);

      const localSnapshot = makeSnapshot({
        profiles: [{ id: "p1", name: "PMC", mode: "PVP", faction: "BEAR", face: null }],
      });
      const result = await pickAndLink(localSnapshot);

      expect(result).toEqual({ status: "linked" });
      expect(JSON.parse(files.get("tarkovguides-progress.json") ?? "{}")).toMatchObject({
        activeProfileId: null,
      });
    });

    it("returns 'restored' when the folder has a backup and local state is empty", async () => {
      const { handle, files } = makeFakeHandle();
      const folderSnapshot = makeSnapshot({
        profiles: [{ id: "p2", name: "Existing", mode: "PVE", faction: "USEC", face: null }],
      });
      files.set("tarkovguides-progress.json", JSON.stringify(folderSnapshot));
      window.showDirectoryPicker = vi.fn().mockResolvedValue(handle);

      const result = await pickAndLink(makeSnapshot({ profiles: [] }));

      expect(result.status).toBe("restored");
      if (result.status === "restored") {
        expect(result.snapshot.profiles[0]?.name).toBe("Existing");
      }
    });

    it("returns 'conflict' when the folder has a backup and local state has real progress", async () => {
      const { handle, files } = makeFakeHandle();
      const folderSnapshot = makeSnapshot({
        profiles: [{ id: "p2", name: "Existing", mode: "PVE", faction: "USEC", face: null }],
      });
      files.set("tarkovguides-progress.json", JSON.stringify(folderSnapshot));
      window.showDirectoryPicker = vi.fn().mockResolvedValue(handle);

      const localSnapshot = makeSnapshot({
        profiles: [{ id: "p1", name: "Local", mode: "PVP", faction: "BEAR", face: null }],
      });
      const result = await pickAndLink(localSnapshot);

      expect(result.status).toBe("conflict");
      if (result.status === "conflict") {
        expect(result.folderSnapshot.profiles[0]?.name).toBe("Existing");
      }
    });

    it("returns 'cancelled' when the picker is dismissed", async () => {
      window.showDirectoryPicker = vi
        .fn()
        .mockRejectedValue(new DOMException("aborted", "AbortError"));
      await expect(pickAndLink(makeSnapshot())).resolves.toEqual({ status: "cancelled" });
    });

    it("returns 'cancelled' when showDirectoryPicker isn't available", async () => {
      await expect(pickAndLink(makeSnapshot())).resolves.toEqual({ status: "cancelled" });
    });
  });

  describe("resolveConflict", () => {
    it("'replace' returns the folder snapshot untouched", async () => {
      const folderSnapshot = makeSnapshot({ activeProfileId: "folder-profile" });
      const result = await resolveConflict("replace", folderSnapshot, makeSnapshot());
      expect(result).toBe(folderSnapshot);
    });

    it("'keep-local' overwrites the folder's file with the local snapshot and returns null", async () => {
      const { handle, files } = makeFakeHandle();
      vi.mocked(idbGet).mockResolvedValue(handle);

      const localSnapshot = makeSnapshot({ activeProfileId: "local-profile" });
      const result = await resolveConflict("keep-local", makeSnapshot(), localSnapshot);

      expect(result).toBeNull();
      expect(JSON.parse(files.get("tarkovguides-progress.json") ?? "{}")).toMatchObject({
        activeProfileId: "local-profile",
      });
    });
  });

  describe("unlink", () => {
    it("clears the linked handle so getLinkStatus resolves null afterward", async () => {
      const { handle } = makeFakeHandle();
      vi.mocked(idbGet).mockResolvedValue(handle);

      await expect(getLinkStatus()).resolves.not.toBeNull();

      await unlink();
      vi.mocked(idbGet).mockResolvedValue(undefined);
      await expect(getLinkStatus()).resolves.toBeNull();
    });
  });

  describe("requestReconnect", () => {
    it("returns false when nothing is linked", async () => {
      await expect(requestReconnect()).resolves.toBe(false);
    });

    it("returns true when requestPermission grants readwrite", async () => {
      const { handle, setPermission } = makeFakeHandle();
      setPermission("granted");
      vi.mocked(idbGet).mockResolvedValue(handle);

      await expect(requestReconnect()).resolves.toBe(true);
    });
  });

  describe("fsaFolderAdapter.write / .read", () => {
    it("write() no-ops when nothing is linked", async () => {
      await expect(fsaFolderAdapter.write(makeSnapshot())).resolves.toBeUndefined();
    });

    it("read() resolves null when nothing is linked", async () => {
      await expect(fsaFolderAdapter.read()).resolves.toBeNull();
    });

    it("write() persists to the linked handle when permission is granted", async () => {
      const { handle, files } = makeFakeHandle();
      vi.mocked(idbGet).mockResolvedValue(handle);

      await fsaFolderAdapter.write(makeSnapshot({ activeProfileId: "written" }));

      expect(JSON.parse(files.get("tarkovguides-progress.json") ?? "{}")).toMatchObject({
        activeProfileId: "written",
      });
    });

    it("write() is a silent no-op when permission is denied", async () => {
      const { handle, setPermission, files } = makeFakeHandle();
      setPermission("denied");
      vi.mocked(idbGet).mockResolvedValue(handle);

      await fsaFolderAdapter.write(makeSnapshot());

      expect(files.has("tarkovguides-progress.json")).toBe(false);
    });

    it("read() returns the linked folder's snapshot", async () => {
      const { handle, files } = makeFakeHandle();
      files.set(
        "tarkovguides-progress.json",
        JSON.stringify(makeSnapshot({ activeProfileId: "x" })),
      );
      vi.mocked(idbGet).mockResolvedValue(handle);

      const result = await fsaFolderAdapter.read();
      expect(result?.activeProfileId).toBe("x");
    });
  });
});
