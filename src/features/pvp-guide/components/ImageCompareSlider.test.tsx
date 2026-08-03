import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installCapturingIntersectionObserver } from "@/test/intersection-observer";

import { ImageCompareSlider } from "./ImageCompareSlider";

const LEFT_SRC = "/images/pvp-guide/peek-right-hand.jpg";
const RIGHT_SRC = "/images/pvp-guide/peek-left-hand.jpg";
const RESET_THRESHOLD = 0.25;
const INTRO_THRESHOLD = 0.98;

function renderSlider(props: Partial<React.ComponentProps<typeof ImageCompareSlider>> = {}) {
  return render(
    <ImageCompareSlider
      leftSrc={LEFT_SRC}
      rightSrc={RIGHT_SRC}
      leftAlt="Right-hand peek"
      rightAlt="Left-hand peek"
      {...props}
    />,
  );
}

describe("ImageCompareSlider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders both images with their given src and alt from the first render, with no play gate", () => {
    const { container } = renderSlider();
    const images = container.querySelectorAll("img");
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute("src", RIGHT_SRC);
    expect(images[0]).toHaveAttribute("alt", "Left-hand peek");
    expect(images[1]).toHaveAttribute("src", LEFT_SRC);
    expect(images[1]).toHaveAttribute("alt", "Right-hand peek");
    expect(screen.queryByRole("button", { name: "Play comparison" })).not.toBeInTheDocument();
  });

  it("shows an error state when either image fails", () => {
    const { container } = renderSlider();
    const [right] = Array.from(container.querySelectorAll("img"));

    act(() => {
      right?.dispatchEvent(new Event("error"));
    });
    expect(screen.getByText("Image failed to load")).toBeInTheDocument();
  });

  it("renders a caption when provided", () => {
    renderSlider({ caption: "Right-hand angle vs. left-hand angle." });
    expect(screen.getByText("Right-hand angle vs. left-hand angle.")).toBeInTheDocument();
  });

  it("renders left/right labels when provided, and omits them otherwise", () => {
    const { rerender } = renderSlider();
    expect(screen.queryByText("Right-Hand")).not.toBeInTheDocument();
    expect(screen.queryByText("Left-Hand")).not.toBeInTheDocument();

    rerender(
      <ImageCompareSlider
        leftSrc={LEFT_SRC}
        rightSrc={RIGHT_SRC}
        leftAlt="Right-hand peek"
        rightAlt="Left-hand peek"
        leftLabel="Right-Hand"
        rightLabel="Left-Hand"
      />,
    );
    expect(screen.getByText("Right-Hand")).toBeInTheDocument();
    expect(screen.getByText("Left-Hand")).toBeInTheDocument();
  });

  describe("side-by-side toggle", () => {
    it("starts in overlay mode, with the divider slider present", () => {
      renderSlider();
      expect(screen.getByRole("slider", { name: "Comparison position" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Show both images side by side" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("switches to side-by-side mode and hides the divider, then switches back", () => {
      renderSlider();
      const toggle = screen.getByRole("button", { name: "Show both images side by side" });

      act(() => {
        toggle.click();
      });
      expect(screen.queryByRole("slider", { name: "Comparison position" })).not.toBeInTheDocument();
      const toggledBack = screen.getByRole("button", { name: "Show overlay comparison" });
      expect(toggledBack).toHaveAttribute("aria-pressed", "true");

      act(() => {
        toggledBack.click();
      });
      expect(screen.getByRole("slider", { name: "Comparison position" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Show both images side by side" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("keeps the same image elements across a toggle, rather than remounting them", () => {
      const { container } = renderSlider();
      const imagesBefore = Array.from(container.querySelectorAll("img"));

      act(() => {
        screen.getByRole("button", { name: "Show both images side by side" }).click();
      });

      const imagesAfter = Array.from(container.querySelectorAll("img"));
      expect(imagesAfter).toEqual(imagesBefore);
    });
  });

  it("exposes an ARIA slider starting at 50", () => {
    renderSlider();
    const slider = screen.getByRole("slider", { name: "Comparison position" });
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "100");
    expect(slider).toHaveAttribute("aria-valuenow", "50");
  });

  describe("keyboard interaction", () => {
    it("nudges right on ArrowRight and left on ArrowLeft", () => {
      renderSlider();
      const slider = screen.getByRole("slider", { name: "Comparison position" });

      act(() => {
        slider.focus();
        slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      });
      expect(slider).toHaveAttribute("aria-valuenow", "55");

      act(() => {
        slider.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
      });
      expect(slider).toHaveAttribute("aria-valuenow", "50");
    });

    it("jumps to the ends on Home and End", () => {
      renderSlider();
      const slider = screen.getByRole("slider", { name: "Comparison position" });

      act(() => {
        slider.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
      });
      expect(slider).toHaveAttribute("aria-valuenow", "100");

      act(() => {
        slider.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
      });
      expect(slider).toHaveAttribute("aria-valuenow", "0");
    });

    it("ignores keys it doesn't handle", () => {
      renderSlider();
      const slider = screen.getByRole("slider", { name: "Comparison position" });

      act(() => {
        slider.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
      });
      expect(slider).toHaveAttribute("aria-valuenow", "50");
    });
  });

  describe("intro reveal animation", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("eases the divider to the reveal position once the whole card is on screen", () => {
      const observer = installCapturingIntersectionObserver();

      renderSlider();
      const slider = screen.getByRole("slider", { name: "Comparison position" });
      expect(slider).toHaveAttribute("aria-valuenow", "50");

      act(() => {
        observer.fireForThreshold(INTRO_THRESHOLD, true);
      });
      expect(slider).toHaveAttribute("aria-valuenow", "50");

      act(() => {
        vi.runAllTimers();
      });
      expect(slider).toHaveAttribute("aria-valuenow", "88");

      observer.restore();
    });

    it("replays the reveal every time the card re-enters full view, not just the first", () => {
      const observer = installCapturingIntersectionObserver();

      renderSlider();
      const slider = screen.getByRole("slider", { name: "Comparison position" });

      act(() => {
        observer.fireForThreshold(RESET_THRESHOLD, true);
        observer.fireForThreshold(INTRO_THRESHOLD, true);
      });
      act(() => {
        vi.runAllTimers();
      });
      expect(slider).toHaveAttribute("aria-valuenow", "88");

      act(() => {
        observer.fireForThreshold(INTRO_THRESHOLD, false);
        observer.fireForThreshold(RESET_THRESHOLD, false);
      });
      expect(slider).toHaveAttribute("aria-valuenow", "50");

      act(() => {
        observer.fireForThreshold(RESET_THRESHOLD, true);
        observer.fireForThreshold(INTRO_THRESHOLD, true);
      });
      act(() => {
        vi.runAllTimers();
      });
      expect(slider).toHaveAttribute("aria-valuenow", "88");

      observer.restore();
    });

    it("stops resetting/replaying once the reader has taken the divider over themselves", () => {
      const observer = installCapturingIntersectionObserver();

      renderSlider();
      act(() => {
        observer.fireForThreshold(RESET_THRESHOLD, true);
        observer.fireForThreshold(INTRO_THRESHOLD, true);
      });
      act(() => {
        vi.runAllTimers();
      });
      const slider = screen.getByRole("slider", { name: "Comparison position" });
      expect(slider).toHaveAttribute("aria-valuenow", "88");

      act(() => {
        slider.focus();
        slider.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
      });
      expect(slider).toHaveAttribute("aria-valuenow", "0");

      act(() => {
        observer.fireForThreshold(RESET_THRESHOLD, false);
      });
      expect(slider).toHaveAttribute("aria-valuenow", "0");

      act(() => {
        observer.fireForThreshold(RESET_THRESHOLD, true);
        observer.fireForThreshold(INTRO_THRESHOLD, true);
      });
      act(() => {
        vi.runAllTimers();
      });
      expect(slider).toHaveAttribute("aria-valuenow", "0");

      observer.restore();
    });
  });
});
