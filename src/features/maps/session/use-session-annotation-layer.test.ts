import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useMutation, useStorage } from "./liveblocks-config";
import { useMapSessionStore } from "./session-store";
import { useSessionAnnotationLayer } from "./use-session-annotation-layer";

import type { Stroke } from "../types";

vi.mock("./liveblocks-config", () => ({
  useStorage: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("./session-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./session-store")>();
  return { ...actual, getParticipantId: () => "participant-1" };
});

function pen(id: string): Stroke {
  return { id, type: "pen", color: "#ff3b3b", width: 4, points: [{ fx: 0, fy: 0 }] };
}

describe("useSessionAnnotationLayer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMapSessionStore.getState().clearActiveSession();
  });

  it("returns null when no session is active", () => {
    vi.mocked(useStorage).mockReturnValue(null);
    vi.mocked(useMutation).mockReturnValue(vi.fn() as never);

    const { result } = renderHook(() => useSessionAnnotationLayer("customs", "2d"));
    expect(result.current).toBeNull();
  });

  it("returns an empty layer when the session has no entry for this map+variant yet", () => {
    useMapSessionStore
      .getState()
      .setActiveSession({ code: "x", roomId: "maps:x", role: "host", displayName: "Alice" });
    vi.mocked(useStorage).mockReturnValue(undefined);
    vi.mocked(useMutation).mockReturnValue(vi.fn() as never);

    const { result } = renderHook(() => useSessionAnnotationLayer("customs", "2d"));
    expect(result.current?.layer).toEqual({ strokes: [] });
    expect(result.current?.authorId).toBe("participant-1");
  });

  it("projects the JSON storage snapshot into a MapAnnotationLayer", () => {
    useMapSessionStore
      .getState()
      .setActiveSession({ code: "x", roomId: "maps:x", role: "host", displayName: "Alice" });
    vi.mocked(useStorage).mockReturnValue({
      strokes: { "1": pen("1") },
    });
    vi.mocked(useMutation).mockReturnValue(vi.fn() as never);

    const { result } = renderHook(() => useSessionAnnotationLayer("customs", "2d"));
    expect(result.current?.layer.strokes).toEqual([pen("1")]);
  });

  it("diffs onChangeLayer against the current layer and applies only the delta", () => {
    useMapSessionStore
      .getState()
      .setActiveSession({ code: "x", roomId: "maps:x", role: "host", displayName: "Alice" });
    vi.mocked(useStorage).mockReturnValue({
      strokes: { "1": pen("1") },
    });
    const applyChange = vi.fn();
    vi.mocked(useMutation).mockReturnValue(applyChange as never);

    const { result } = renderHook(() => useSessionAnnotationLayer("customs", "2d"));
    result.current?.onChangeLayer({ strokes: [pen("1"), pen("2")] });

    expect(applyChange).toHaveBeenCalledExactlyOnceWith(
      "customs:2d",
      { addedStrokes: [pen("2")], removedStrokeIds: [] },
      "participant-1",
    );
  });

  it("skips the mutation entirely when there's no actual diff", () => {
    useMapSessionStore
      .getState()
      .setActiveSession({ code: "x", roomId: "maps:x", role: "host", displayName: "Alice" });
    vi.mocked(useStorage).mockReturnValue({ strokes: { "1": pen("1") } });
    const applyChange = vi.fn();
    vi.mocked(useMutation).mockReturnValue(applyChange as never);

    const { result } = renderHook(() => useSessionAnnotationLayer("customs", "2d"));
    result.current?.onChangeLayer({ strokes: [pen("1")] });

    expect(applyChange).not.toHaveBeenCalled();
  });
});
