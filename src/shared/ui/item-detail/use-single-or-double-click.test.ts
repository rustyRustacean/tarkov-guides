import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSingleOrDoubleClick } from "./use-single-or-double-click";

describe("useSingleOrDoubleClick", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires the single-click action after the delay", () => {
    const single = vi.fn();
    const double = vi.fn();
    const { result } = renderHook(() => useSingleOrDoubleClick(single, double, 200));

    act(() => {
      result.current.onClick();
    });
    expect(single).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(single).toHaveBeenCalledTimes(1);
    expect(double).not.toHaveBeenCalled();
  });

  it("fires only the double-click action for a click-click-dblclick sequence", () => {
    const single = vi.fn();
    const double = vi.fn();
    const { result } = renderHook(() => useSingleOrDoubleClick(single, double, 200));

    act(() => {
      result.current.onClick();
      result.current.onClick();
      result.current.onDoubleClick();
      vi.advanceTimersByTime(500);
    });
    expect(double).toHaveBeenCalledTimes(1);
    expect(single).not.toHaveBeenCalled();
  });

  it("clears a pending timer on unmount", () => {
    const single = vi.fn();
    const { result, unmount } = renderHook(() =>
      useSingleOrDoubleClick(single, () => undefined, 200),
    );
    act(() => {
      result.current.onClick();
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(single).not.toHaveBeenCalled();
  });
});
