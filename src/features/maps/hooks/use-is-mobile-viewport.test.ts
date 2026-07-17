import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useIsMobileViewport } from "./use-is-mobile-viewport";

/** A minimal mutable fake `MediaQueryList` so a test can flip `matches` and fire `change`. */
function installMatchMediaMock(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  const mql = {
    get matches() {
      return matches;
    },
    media: "(max-width: 640px)",
    onchange: null,
    addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.delete(listener);
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  };

  window.matchMedia = () => mql as unknown as MediaQueryList;

  return {
    setMatches: (value: boolean) => {
      matches = value;
      listeners.forEach((listener) => {
        listener({ matches: value } as MediaQueryListEvent);
      });
    },
  };
}

describe("useIsMobileViewport", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reflects the initial matchMedia value", () => {
    installMatchMediaMock(true);
    const { result } = renderHook(() => useIsMobileViewport());
    expect(result.current).toBe(true);
  });

  it("defaults to false when the viewport is wider than the breakpoint", () => {
    installMatchMediaMock(false);
    const { result } = renderHook(() => useIsMobileViewport());
    expect(result.current).toBe(false);
  });

  it("updates live when the viewport crosses the breakpoint", () => {
    const mock = installMatchMediaMock(false);
    const { result } = renderHook(() => useIsMobileViewport());
    expect(result.current).toBe(false);

    act(() => {
      mock.setMatches(true);
    });

    expect(result.current).toBe(true);
  });
});
