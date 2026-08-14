import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient } from "@/test/render-with-providers";

import {
  COMPANION_AUTOLAUNCH_KEY,
  COMPANION_EVER_CONNECTED_KEY,
  type CompanionStatus,
} from "./companion-config";
import {
  fetchCompanionStatus,
  launchCompanion,
  useAutoLaunchPreference,
  useCompanionAutoLaunch,
} from "./use-companion";

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
    raidLocation: null,
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

  it("defaults to true (an opt-out) and persists turning it off", () => {
    const { result } = renderHook(() => useAutoLaunchPreference());
    expect(result.current[0]).toBe(true);

    act(() => {
      result.current[1](false);
    });

    expect(result.current[0]).toBe(false);
    expect(localStorage.getItem(COMPANION_AUTOLAUNCH_KEY)).toBe("0");
  });

  it("restores a stored opt-out on mount", () => {
    localStorage.setItem(COMPANION_AUTOLAUNCH_KEY, "0");
    const { result } = renderHook(() => useAutoLaunchPreference());
    expect(result.current[0]).toBe(false);
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

describe("useCompanionAutoLaunch", () => {
  function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: createTestQueryClient() }, children);
  }

  function protocolFired(): boolean {
    return document.querySelector("iframe") !== null;
  }

  beforeEach(() => {
    localStorage.clear();
    // These tests exercise the everConnected/re-launch gating, not the
    // opt-in toggle itself (that's covered by the useAutoLaunchPreference
    // tests above), so opt in up front.
    localStorage.setItem(COMPANION_AUTOLAUNCH_KEY, "1");
    document.querySelectorAll("iframe").forEach((frame) => {
      frame.remove();
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("neither polls nor fires the protocol on a machine that has never had the companion", async () => {
    // The whole point, doubly so now that the preference defaults ON: an
    // unregistered masttarkov:// hand-off makes Windows pop a Microsoft Store
    // dialog, and even the localhost status poll trips Chromium's
    // local-network permission prompt - a first-time visitor must get neither.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    renderHook(
      () => {
        useCompanionAutoLaunch();
      },
      { wrapper },
    );

    // Absence has no event to await - give any wrongly-scheduled poll a
    // moment to happen, then require that none did.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
    expect(protocolFired()).toBe(false);
  });

  it("leaves a live companion alone, then re-launches after it goes away", async () => {
    // A machine with the evidence: the panel's own open-state polling is what
    // records the first connection (this hook's poll is gated on it).
    localStorage.setItem(COMPANION_EVER_CONNECTED_KEY, "1");
    const status = makeStatus();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(status) }),
    );
    const first = renderHook(
      () => {
        useCompanionAutoLaunch();
      },
      { wrapper },
    );

    await vi.waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalled();
    });
    // Already up: nothing to launch.
    expect(protocolFired()).toBe(false);
    first.unmount();

    // Same machine later, companion has idled out. Now the hand-off is a
    // re-launch of something known to exist, so it's allowed.
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    renderHook(
      () => {
        useCompanionAutoLaunch();
      },
      { wrapper },
    );

    await vi.waitFor(() => {
      expect(protocolFired()).toBe(true);
    });
  });

  it("forgets the companion when a hand-off produces nothing, so uninstalling stops the popup", async () => {
    // `shouldAdvanceTime` keeps react-query's own polling alive while still
    // letting the grace period be jumped rather than waited out.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      localStorage.setItem(COMPANION_EVER_CONNECTED_KEY, "1");
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
      renderHook(
        () => {
          useCompanionAutoLaunch();
        },
        { wrapper },
      );

      await vi.waitFor(() => {
        expect(protocolFired()).toBe(true);
      });

      // Grace period passes with nothing answering: the handler is gone.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(21_000);
      });
      expect(localStorage.getItem(COMPANION_EVER_CONNECTED_KEY)).toBe("0");
    } finally {
      vi.useRealTimers();
    }
  });
});
