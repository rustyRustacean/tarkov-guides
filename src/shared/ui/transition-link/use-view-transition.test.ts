import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useViewTransition } from "./use-view-transition";

describe("useViewTransition", () => {
  it("calls the callback synchronously when the API is unsupported", () => {
    const { result } = renderHook(() => useViewTransition());
    const callback = vi.fn();

    act(() => {
      result.current.startViewTransition(callback);
    });

    expect(callback).toHaveBeenCalledOnce();
  });
});
