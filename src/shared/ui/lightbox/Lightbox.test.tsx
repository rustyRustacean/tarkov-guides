import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Lightbox } from "./Lightbox";

describe("Lightbox", () => {
  it("renders nothing when src is null", () => {
    const { container } = render(<Lightbox src={null} onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("keeps pointer-events enabled on the overlay (works inside a Radix modal that disables body pointer-events)", () => {
    render(<Lightbox src="https://example.com/shot.png" onClose={vi.fn()} />);
    const overlay = document.querySelector('[role="dialog"]');
    expect(overlay?.className).toContain("pointer-events-auto");
  });

  it("closes when the backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<Lightbox src="https://example.com/shot.png" onClose={onClose} />);
    const backdrop = document.querySelector(".bg-black\\/80");
    expect(backdrop).not.toBeNull();
    if (backdrop) fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when the X button is clicked", () => {
    const onClose = vi.fn();
    render(<Lightbox src="https://example.com/shot.png" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<Lightbox src="https://example.com/shot.png" onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
