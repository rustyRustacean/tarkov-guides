import { act, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useSheetDrag } from "./use-sheet-drag";

/** Stubs `getBoundingClientRect().height` for a detached test element; jsdom always reports 0 otherwise. */
function stubHeight(el: HTMLElement, height: number): void {
  el.getBoundingClientRect = () =>
    ({ height, width: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0 }) as DOMRect;
}

function firePointer(
  el: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup",
  clientY: number,
): void {
  el.dispatchEvent(new PointerEvent(type, { clientY, pointerId: 1, bubbles: true }));
}

interface HarnessProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Harness({ open, onOpenChange }: HarnessProps) {
  const { handleRef, containerRef } = useSheetDrag({ isOpen: open, onOpenChange });
  return (
    <div>
      <button ref={handleRef} type="button" data-testid="handle" />
      <div
        data-testid="sheet"
        ref={(el) => {
          containerRef(el);
          if (el) stubHeight(el, 1000);
        }}
      />
    </div>
  );
}

function setUp(isOpen: boolean, onOpenChange: (open: boolean) => void) {
  const { container: root, rerender } = render(
    <Harness open={isOpen} onOpenChange={onOpenChange} />,
  );
  const handle = within(root).getByTestId("handle");
  const sheet = within(root).getByTestId("sheet");
  return {
    handle,
    container: sheet,
    rerender: (open: boolean) => {
      rerender(<Harness open={open} onOpenChange={onOpenChange} />);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSheetDrag", () => {
  it("a tap (no movement) toggles the prior open state", () => {
    const onOpenChange = vi.fn();
    const { handle } = setUp(false, onOpenChange);

    act(() => {
      firePointer(handle, "pointerdown", 500);
      firePointer(handle, "pointerup", 500);
    });

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("live-resizes the container's grid-template-rows during a drag", () => {
    const onOpenChange = vi.fn();
    const { handle, container } = setUp(false, onOpenChange);

    act(() => {
      firePointer(handle, "pointerdown", 500);
      firePointer(handle, "pointermove", 300);
    });

    // Dragging up (dy = -200) from the closed resting height (46px) should
    // grow the bottom row toward 246px, and the top row shrink correspondingly.
    expect(container.style.transition).toBe("none");
    expect(container.style.gridTemplateRows).toBe("754px 246px");
  });

  it("restores the CSS transition and snaps to a resting height on release", () => {
    const onOpenChange = vi.fn();
    const { handle, container } = setUp(false, onOpenChange);

    act(() => {
      firePointer(handle, "pointerdown", 500);
      firePointer(handle, "pointermove", 100);
      firePointer(handle, "pointerup", 100);
    });

    expect(container.style.transition).toBe("");
    // A fast upward drag (large dy, ~0 elapsed time) reads as a flick -> opens.
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(container.style.gridTemplateRows).toBe("260px 740px");
  });

  it("a slow drag released past the height threshold snaps open, using real elapsed time for velocity", () => {
    let now = 0;
    vi.spyOn(performance, "now").mockImplementation(() => now);
    const onOpenChange = vi.fn();
    const { handle } = setUp(false, onOpenChange);

    act(() => {
      now = 0;
      firePointer(handle, "pointerdown", 500);
      now = 1000; // 1 full second elapsed; velocity works out well under the flick threshold.
      firePointer(handle, "pointermove", 100); // dy = -400 -> well past the 35% height threshold.
      now = 1001;
      firePointer(handle, "pointerup", 100);
    });

    expect(onOpenChange).toHaveBeenCalledWith(true);
  });

  it("syncs the container height when isOpen changes from outside a drag", () => {
    const onOpenChange = vi.fn();
    const { container, rerender } = setUp(false, onOpenChange);

    act(() => {
      rerender(true);
    });

    // OPEN_FRACTION (0.74) of the 1000px stubbed container height.
    expect(container.style.gridTemplateRows).toBe("260px 740px");
  });
});
