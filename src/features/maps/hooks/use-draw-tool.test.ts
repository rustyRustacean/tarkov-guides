import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDrawTool } from "./use-draw-tool";

function fireKey(type: "keydown" | "keyup", init: KeyboardEventInit): void {
  window.dispatchEvent(new KeyboardEvent(type, init));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useDrawTool", () => {
  it("starts with draw mode off, pen selected, default color/width", () => {
    const { result } = renderHook(() => useDrawTool({ onUndo: vi.fn() }));
    expect(result.current.drawModeOn).toBe(false);
    expect(result.current.baseTool).toBe("pen");
    expect(result.current.effectiveTool).toBe("pen");
    expect(result.current.color).toBe("#ff3b3b");
    expect(result.current.width).toBe(4);
  });

  it("toggleDrawMode flips drawModeOn", () => {
    const { result } = renderHook(() => useDrawTool({ onUndo: vi.fn() }));
    act(() => {
      result.current.toggleDrawMode();
    });
    expect(result.current.drawModeOn).toBe(true);
    act(() => {
      result.current.toggleDrawMode();
    });
    expect(result.current.drawModeOn).toBe(false);
  });

  it("setBaseTool changes both baseTool and effectiveTool when no modifier is held", () => {
    const { result } = renderHook(() => useDrawTool({ onUndo: vi.fn() }));
    act(() => {
      result.current.setBaseTool("erase");
    });
    expect(result.current.baseTool).toBe("erase");
    expect(result.current.effectiveTool).toBe("erase");
  });

  it("holding Shift while draw mode is on temporarily switches effectiveTool to circle, restored on release", () => {
    const { result } = renderHook(() => useDrawTool({ onUndo: vi.fn() }));
    act(() => {
      result.current.toggleDrawMode();
    });
    act(() => {
      result.current.setBaseTool("lock");
    });

    act(() => {
      fireKey("keydown", { key: "Shift" });
    });
    expect(result.current.effectiveTool).toBe("circle");

    act(() => {
      fireKey("keyup", { key: "Shift" });
    });
    expect(result.current.effectiveTool).toBe("lock");
  });

  it("holding Ctrl while draw mode is on temporarily switches effectiveTool to erase", () => {
    const { result } = renderHook(() => useDrawTool({ onUndo: vi.fn() }));
    act(() => {
      result.current.toggleDrawMode();
    });

    act(() => {
      fireKey("keydown", { key: "Control", ctrlKey: true });
    });
    expect(result.current.effectiveTool).toBe("erase");

    act(() => {
      fireKey("keyup", { key: "Control" });
    });
    expect(result.current.effectiveTool).toBe("pen");
  });

  it("modifier keys are ignored while draw mode is off", () => {
    const { result } = renderHook(() => useDrawTool({ onUndo: vi.fn() }));
    act(() => {
      fireKey("keydown", { key: "Shift" });
    });
    expect(result.current.effectiveTool).toBe("pen");
  });

  it("Escape exits draw mode", () => {
    const { result } = renderHook(() => useDrawTool({ onUndo: vi.fn() }));
    act(() => {
      result.current.toggleDrawMode();
    });
    expect(result.current.drawModeOn).toBe(true);

    act(() => {
      fireKey("keydown", { key: "Escape" });
    });
    expect(result.current.drawModeOn).toBe(false);
  });

  it("Ctrl+Z calls onUndo while draw mode is on, not when it's off", () => {
    const onUndo = vi.fn();
    const { result } = renderHook(() => useDrawTool({ onUndo }));

    act(() => {
      fireKey("keydown", { key: "z", ctrlKey: true });
    });
    expect(onUndo).not.toHaveBeenCalled();

    act(() => {
      result.current.toggleDrawMode();
    });
    act(() => {
      fireKey("keydown", { key: "z", ctrlKey: true });
    });
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("setColor/setWidth update their respective state", () => {
    const { result } = renderHook(() => useDrawTool({ onUndo: vi.fn() }));
    act(() => {
      result.current.setColor("#3b86ff");
    });
    act(() => {
      result.current.setWidth(20);
    });
    expect(result.current.color).toBe("#3b86ff");
    expect(result.current.width).toBe(20);
  });
});
