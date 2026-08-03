import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useCompanionPosition } from "@/features/companion/use-companion";

import { useOthers, useUpdateMyPresence } from "./liveblocks-config";
import { useMapSessionStore } from "./session-store";
import { positionKey, useSessionPlayerPositions } from "./use-session-positions";

import type { CompanionPosition } from "@/features/companion/companion-config";

vi.mock("./liveblocks-config", () => ({
  useOthers: vi.fn(),
  useUpdateMyPresence: vi.fn(),
}));

vi.mock("@/features/companion/use-companion", () => ({
  useCompanionPosition: vi.fn(),
}));

const updateMyPresence = vi.fn();

function position(overrides: Partial<CompanionPosition> = {}): CompanionPosition {
  return { x: 10, z: 20, yaw: 90, at: 1000, map: "RezervBase", ...overrides };
}

/** One entry of what `useOthers` hands back - only the fields this hook reads. */
function other(id: string, presencePosition: CompanionPosition | null) {
  return {
    id,
    info: { name: `Player ${id}`, color: "#3b82f6", isHost: false },
    presence: { position: presencePosition },
  };
}

function startSession(): void {
  useMapSessionStore
    .getState()
    .setActiveSession({ code: "abc", roomId: "maps:abc", role: "host", displayName: "Alice" });
}

beforeEach(() => {
  vi.clearAllMocks();
  useMapSessionStore.getState().clearActiveSession();
  vi.mocked(useUpdateMyPresence).mockReturnValue(updateMyPresence as never);
  vi.mocked(useOthers).mockReturnValue([] as never);
  vi.mocked(useCompanionPosition).mockReturnValue(null);
});

describe("positionKey", () => {
  it("is null for no position, and identical for the same capture", () => {
    expect(positionKey(null)).toBeNull();
    expect(positionKey(position())).toBe(positionKey(position()));
  });

  it("changes when the capture does", () => {
    expect(positionKey(position({ at: 2000 }))).not.toBe(positionKey(position()));
    expect(positionKey(position({ x: 11 }))).not.toBe(positionKey(position()));
  });
});

describe("useSessionPlayerPositions", () => {
  it("publishes nothing while no session is active", () => {
    vi.mocked(useCompanionPosition).mockReturnValue(position());

    renderHook(() => useSessionPlayerPositions());

    expect(updateMyPresence).not.toHaveBeenCalled();
  });

  it("publishes the local position once a session is active", () => {
    startSession();
    vi.mocked(useCompanionPosition).mockReturnValue(position());

    renderHook(() => useSessionPlayerPositions());

    expect(updateMyPresence).toHaveBeenCalledWith({
      position: { x: 10, z: 20, yaw: 90, map: "RezervBase", at: 1000 },
    });
  });

  it("does not republish a position that hasn't changed", () => {
    startSession();
    // A fresh object every render - what the companion's polling query really
    // hands back, and the reason this dedupes on value rather than identity.
    vi.mocked(useCompanionPosition).mockImplementation(() => position());

    const { rerender } = renderHook(() => useSessionPlayerPositions());
    rerender();
    rerender();

    expect(updateMyPresence).toHaveBeenCalledTimes(1);
  });

  it("publishes again when the player moves", () => {
    startSession();
    vi.mocked(useCompanionPosition).mockReturnValue(position());
    const { rerender } = renderHook(() => useSessionPlayerPositions());

    vi.mocked(useCompanionPosition).mockReturnValue(position({ x: 55, at: 2000 }));
    rerender();

    expect(updateMyPresence).toHaveBeenCalledTimes(2);
    expect(updateMyPresence).toHaveBeenLastCalledWith({
      position: { x: 55, z: 20, yaw: 90, map: "RezervBase", at: 2000 },
    });
  });

  it("returns each teammate that has published a position, skipping those that haven't", () => {
    startSession();
    vi.mocked(useOthers).mockReturnValue([
      other("p1", position()),
      other("p2", null),
      other("p3", position({ x: 99 })),
    ] as never);

    const { result } = renderHook(() => useSessionPlayerPositions());

    expect(result.current.map((player) => player.id)).toEqual(["p1", "p3"]);
    expect(result.current[0]).toMatchObject({ name: "Player p1", color: "#3b82f6" });
    expect(result.current[1]?.position.x).toBe(99);
  });
});
