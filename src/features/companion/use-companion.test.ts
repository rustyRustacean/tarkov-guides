import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COMPANION_AUTOLAUNCH_KEY, type CompanionStatus } from "./companion-config";
import { fetchCompanionStatus, launchCompanion, useAutoLaunchPreference } from "./use-companion";

function makeStatus(overrides: Partial<CompanionStatus> = {}): CompanionStatus {
  return {
    app: "MasterTarkov-Companion",
    version: "1.0.0",
    running: true,
    session: "log_2026.08.01",
    gameVersion: "1.0.6.5.46221",
    mode: "pvp",
    profileId: "p1",
    faction: "BEAR",
    questsAvailable: true,
    quests: {},
    questCounts: { started: 2, finished: 5, failed: 0 },
    position: null,
    positionRevision: 0,
    revision: 1,
    updatedAt: 0,
    ...overrides,
  };
}

describe("fetchCompanionStatus", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the payload when the companion answers", async () => {
    const status = makeStatus();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(status) }),
    );
    await expect(fetchCompanionStatus()).resolves.toEqual(status);
  });

  it("returns null on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) }),
    );
    await expect(fetchCompanionStatus()).resolves.toBeNull();
  });

  it("returns null when the request rejects (companion not running)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")));
    await expect(fetchCompanionStatus()).resolves.toBeNull();
  });

  it("returns null for a payload missing the app marker", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ running: true }) }),
    );
    await expect(fetchCompanionStatus()).resolves.toBeNull();
  });
});

describe("useAutoLaunchPreference", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to false and persists a toggle to localStorage", () => {
    const { result } = renderHook(() => useAutoLaunchPreference());
    expect(result.current[0]).toBe(false);

    act(() => {
      result.current[1](true);
    });

    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem(COMPANION_AUTOLAUNCH_KEY)).toBe("1");
  });

  it("restores a stored preference on mount", () => {
    localStorage.setItem(COMPANION_AUTOLAUNCH_KEY, "1");
    const { result } = renderHook(() => useAutoLaunchPreference());
    expect(result.current[0]).toBe(true);
  });
});

describe("launchCompanion", () => {
  it("adds then removes a hidden protocol iframe", () => {
    vi.useFakeTimers();
    try {
      launchCompanion();
      const frame = document.querySelector("iframe");
      expect(frame).not.toBeNull();
      expect(frame?.getAttribute("src")).toContain("masttarkov://");

      act(() => {
        vi.runAllTimers();
      });
      expect(document.querySelector("iframe")).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
