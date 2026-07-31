import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFullscreen } from "./use-fullscreen";

function setFullscreenElement(el: Element | null): void {
  Object.defineProperty(document, "fullscreenElement", {
    value: el,
    configurable: true,
  });
}

beforeEach(() => {
  setFullscreenElement(null);
});

afterEach(() => {
  setFullscreenElement(null);
});

describe("useFullscreen", () => {
  it("defaults isFullscreen to false", () => {
    const { result } = renderHook(() => useFullscreen());
    expect(result.current.isFullscreen).toBe(false);
  });

  it("toggle() calls requestFullscreen on the attached element when not currently fullscreen", () => {
    const { result } = renderHook(() => useFullscreen());
    const el = document.createElement("div");
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    el.requestFullscreen = requestFullscreen;
    result.current.ref.current = el;

    act(() => {
      result.current.toggle();
    });

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it("toggle() calls document.exitFullscreen when already fullscreen", () => {
    const el = document.createElement("div");
    setFullscreenElement(el);
    const exitFullscreen = vi.spyOn(document, "exitFullscreen").mockResolvedValue(undefined);
    const { result } = renderHook(() => useFullscreen());
    result.current.ref.current = el;

    act(() => {
      result.current.toggle();
    });

    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("syncs isFullscreen to true when the fullscreenchange event fires with our element active", () => {
    const { result } = renderHook(() => useFullscreen());
    const el = document.createElement("div");
    result.current.ref.current = el;
    setFullscreenElement(el);

    act(() => {
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(result.current.isFullscreen).toBe(true);
  });

  it("syncs isFullscreen back to false when fullscreenchange fires with no fullscreen element", () => {
    const el = document.createElement("div");
    setFullscreenElement(el);
    const { result } = renderHook(() => useFullscreen());
    result.current.ref.current = el;

    act(() => {
      setFullscreenElement(null);
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(result.current.isFullscreen).toBe(false);
  });

  it('pressing "f" outside an input toggles fullscreen', () => {
    const { result } = renderHook(() => useFullscreen());
    const el = document.createElement("div");
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    el.requestFullscreen = requestFullscreen;
    result.current.ref.current = el;

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "f" }));
    });

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
  });

  it('pressing "f" while focused in a text input does not toggle', () => {
    const { result } = renderHook(() => useFullscreen());
    const el = document.createElement("div");
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    el.requestFullscreen = requestFullscreen;
    result.current.ref.current = el;

    const input = document.createElement("input");
    document.body.appendChild(input);

    act(() => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "f", bubbles: true, cancelable: true }),
      );
    });

    expect(requestFullscreen).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('pressing "Ctrl+f" does not toggle', () => {
    const { result } = renderHook(() => useFullscreen());
    const el = document.createElement("div");
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    el.requestFullscreen = requestFullscreen;
    result.current.ref.current = el;

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true }));
    });

    expect(requestFullscreen).not.toHaveBeenCalled();
  });
});
