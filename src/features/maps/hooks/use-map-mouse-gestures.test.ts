import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMapMouseGestures } from "./use-map-mouse-gestures";

import type L from "leaflet";

function createFakeMap() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const panBy = vi.fn();
  const map = { getContainer: () => container, panBy } as unknown as L.Map;
  return { map, container, panBy };
}

function mouse(type: string, init: MouseEventInit): MouseEvent {
  return new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useMapMouseGestures", () => {
  it("middle-click toggles draw mode", () => {
    const { map, container } = createFakeMap();
    const onToggleDrawMode = vi.fn();
    renderHook(() => {
      useMapMouseGestures({ map, onToggleDrawMode });
    });

    container.dispatchEvent(mouse("auxclick", { button: 1 }));
    expect(onToggleDrawMode).toHaveBeenCalledOnce();
  });

  it("ignores a middle-click when drawing has nowhere to be saved", () => {
    const { map, container } = createFakeMap();
    renderHook(() => {
      useMapMouseGestures({ map, onToggleDrawMode: null });
    });

    // Nothing to assert beyond "does not throw" - the point is that the
    // gesture is inert rather than turning draw mode on with no profile.
    expect(() => container.dispatchEvent(mouse("auxclick", { button: 1 }))).not.toThrow();
  });

  it("suppresses the browser's middle-click autoscroll", () => {
    const { map, container } = createFakeMap();
    renderHook(() => {
      useMapMouseGestures({ map, onToggleDrawMode: vi.fn() });
    });

    const event = mouse("mousedown", { button: 1 });
    container.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("right-drag pans the map by the inverted cursor delta", () => {
    const { map, container, panBy } = createFakeMap();
    renderHook(() => {
      useMapMouseGestures({ map, onToggleDrawMode: vi.fn() });
    });

    container.dispatchEvent(mouse("mousedown", { button: 2, clientX: 100, clientY: 100 }));
    window.dispatchEvent(mouse("mousemove", { clientX: 130, clientY: 90 }));
    expect(panBy).toHaveBeenCalledWith([-30, 10], { animate: false });

    // Deltas are per-move, not cumulative from the drag's start.
    window.dispatchEvent(mouse("mousemove", { clientX: 135, clientY: 85 }));
    expect(panBy).toHaveBeenLastCalledWith([-5, 5], { animate: false });
  });

  it("stops panning on mouseup", () => {
    const { map, container, panBy } = createFakeMap();
    renderHook(() => {
      useMapMouseGestures({ map, onToggleDrawMode: vi.fn() });
    });

    container.dispatchEvent(mouse("mousedown", { button: 2, clientX: 100, clientY: 100 }));
    window.dispatchEvent(mouse("mouseup", { button: 2, clientX: 100, clientY: 100 }));
    window.dispatchEvent(mouse("mousemove", { clientX: 200, clientY: 200 }));
    expect(panBy).not.toHaveBeenCalled();
  });

  it("leaves the left button alone - Leaflet (or the draw tool) owns it", () => {
    const { map, container, panBy } = createFakeMap();
    renderHook(() => {
      useMapMouseGestures({ map, onToggleDrawMode: vi.fn() });
    });

    const event = mouse("mousedown", { button: 0, clientX: 100, clientY: 100 });
    container.dispatchEvent(event);
    window.dispatchEvent(mouse("mousemove", { clientX: 200, clientY: 200 }));
    expect(panBy).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("suppresses the context menu so a right-drag never ends in a popup", () => {
    const { map, container } = createFakeMap();
    renderHook(() => {
      useMapMouseGestures({ map, onToggleDrawMode: vi.fn() });
    });

    const event = mouse("contextmenu", { button: 2 });
    container.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("unsubscribes its window listeners on unmount, mid-drag included", () => {
    const { map, container, panBy } = createFakeMap();
    const { unmount } = renderHook(() => {
      useMapMouseGestures({ map, onToggleDrawMode: vi.fn() });
    });

    container.dispatchEvent(mouse("mousedown", { button: 2, clientX: 100, clientY: 100 }));
    unmount();
    window.dispatchEvent(mouse("mousemove", { clientX: 200, clientY: 200 }));
    expect(panBy).not.toHaveBeenCalled();
  });
});
