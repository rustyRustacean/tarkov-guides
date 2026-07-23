import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSessionUrlParam } from "./use-session-url-param";

const replace = vi.fn();
let currentSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => "/maps",
  useSearchParams: () => currentSearchParams,
}));

describe("useSessionUrlParam", () => {
  beforeEach(() => {
    replace.mockClear();
    currentSearchParams = new URLSearchParams();
  });

  it("returns null when there's no session param", () => {
    const { result } = renderHook(() => useSessionUrlParam());
    expect(result.current.pendingJoinCode).toBeNull();
  });

  it("returns the code from ?session=CODE", () => {
    currentSearchParams = new URLSearchParams("session=silent-scav-42");
    const { result } = renderHook(() => useSessionUrlParam());
    expect(result.current.pendingJoinCode).toBe("silent-scav-42");
  });

  it("clearPendingJoinCode strips the param and replaces the URL", () => {
    currentSearchParams = new URLSearchParams("session=silent-scav-42&foo=bar");
    const { result } = renderHook(() => useSessionUrlParam());
    result.current.clearPendingJoinCode();
    expect(replace).toHaveBeenCalledExactlyOnceWith("/maps?foo=bar", { scroll: false });
  });

  it("clearPendingJoinCode drops the query entirely when session was the only param", () => {
    currentSearchParams = new URLSearchParams("session=silent-scav-42");
    const { result } = renderHook(() => useSessionUrlParam());
    result.current.clearPendingJoinCode();
    expect(replace).toHaveBeenCalledExactlyOnceWith("/maps", { scroll: false });
  });

  it("clearPendingJoinCode is a no-op on the URL when there was no param to begin with", () => {
    const { result } = renderHook(() => useSessionUrlParam());
    result.current.clearPendingJoinCode();
    expect(replace).not.toHaveBeenCalled();
  });
});
