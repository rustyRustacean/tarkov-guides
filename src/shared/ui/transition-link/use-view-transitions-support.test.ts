import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useViewTransitionsSupport } from "./use-view-transitions-support";

describe("useViewTransitionsSupport", () => {
  it("returns false in this jsdom test environment (no View Transitions API)", () => {
    const { result } = renderHook(() => useViewTransitionsSupport());
    expect(result.current).toBe(false);
  });
});
