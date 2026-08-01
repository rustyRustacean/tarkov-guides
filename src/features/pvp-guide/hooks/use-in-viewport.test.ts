import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installCapturingIntersectionObserver } from "@/test/intersection-observer";

import { useInViewport } from "./use-in-viewport";

describe("useInViewport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts false and returns false when there's no node yet", () => {
    const { result } = renderHook(() => useInViewport(null, 0.5));
    expect(result.current).toBe(false);
  });

  it("updates when the observer reports an intersection change", () => {
    const observer = installCapturingIntersectionObserver();
    const node = document.createElement("div");

    const { result } = renderHook(() => useInViewport(node, 0.5));
    expect(result.current).toBe(false);

    act(() => {
      observer.fire(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      observer.fire(false);
    });
    expect(result.current).toBe(false);

    observer.restore();
  });

  it("passes the given threshold through to the observer", () => {
    const observer = installCapturingIntersectionObserver();
    const node = document.createElement("div");

    renderHook(() => useInViewport(node, 0.98));
    expect(observer.getThresholds()).toEqual([0.98]);

    observer.restore();
  });

  it("disconnects the observer on unmount", () => {
    const observer = installCapturingIntersectionObserver();
    const node = document.createElement("div");

    const { unmount } = renderHook(() => useInViewport(node, 0.5));
    unmount();
    expect(observer.disconnect).toHaveBeenCalled();

    observer.restore();
  });
});
