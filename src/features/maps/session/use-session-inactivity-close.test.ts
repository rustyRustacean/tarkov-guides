import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStorage } from "./liveblocks-config";
import { useSessionInactivityClose } from "./use-session-inactivity-close";

vi.mock("./liveblocks-config", () => ({ useStorage: vi.fn() }));

const ONE_HOUR_MS = 60 * 60 * 1000;

describe("useSessionInactivityClose", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(useStorage).mockReturnValue({ hostId: "host-1" });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not fire before the timeout elapses", () => {
    const onTimeout = vi.fn();
    renderHook(() => {
      useSessionInactivityClose(true, onTimeout, ONE_HOUR_MS);
    });

    vi.advanceTimersByTime(ONE_HOUR_MS - 1000);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("fires once the timeout elapses with no activity", () => {
    const onTimeout = vi.fn();
    renderHook(() => {
      useSessionInactivityClose(true, onTimeout, ONE_HOUR_MS);
    });

    vi.advanceTimersByTime(ONE_HOUR_MS + 1000);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("a storage change resets the clock, preventing an otherwise-due timeout", () => {
    const onTimeout = vi.fn();
    let snapshot: unknown = { hostId: "host-1" };
    vi.mocked(useStorage).mockImplementation(() => snapshot);

    const { rerender } = renderHook(() => {
      useSessionInactivityClose(true, onTimeout, ONE_HOUR_MS);
    });

    vi.advanceTimersByTime(ONE_HOUR_MS - 1000);
    // Simulate a storage mutation (e.g. a stroke drawn) just before the deadline.
    snapshot = { hostId: "host-1", view: { zoom: 2 } };
    rerender();

    vi.advanceTimersByTime(2000);
    expect(onTimeout).not.toHaveBeenCalled();

    vi.advanceTimersByTime(ONE_HOUR_MS);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("never fires while inactive", () => {
    const onTimeout = vi.fn();
    renderHook(() => {
      useSessionInactivityClose(false, onTimeout, ONE_HOUR_MS);
    });

    vi.advanceTimersByTime(ONE_HOUR_MS * 5);
    expect(onTimeout).not.toHaveBeenCalled();
  });

  it("fires only once even if checked past the threshold repeatedly", () => {
    const onTimeout = vi.fn();
    renderHook(() => {
      useSessionInactivityClose(true, onTimeout, ONE_HOUR_MS);
    });

    vi.advanceTimersByTime(ONE_HOUR_MS * 3);
    expect(onTimeout).toHaveBeenCalledOnce();
  });
});
