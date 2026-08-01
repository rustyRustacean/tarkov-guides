import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installCapturingIntersectionObserver } from "@/test/intersection-observer";

import { VideoCompareSlider } from "./VideoCompareSlider";

const LEFT_SRC = "/videos/pvp-guide/peeker-pov.webm";
const RIGHT_SRC = "/videos/pvp-guide/enemy-pov.webm";
const AUTOPLAY_THRESHOLD = 0.25;
const INTRO_THRESHOLD = 0.98;

function renderSlider(props: Partial<React.ComponentProps<typeof VideoCompareSlider>> = {}) {
  return render(
    <VideoCompareSlider
      leftSrc={LEFT_SRC}
      rightSrc={RIGHT_SRC}
      leftAlt="Peeker's POV"
      rightAlt="Enemy's POV"
      {...props}
    />,
  );
}

function clickPlay(): void {
  screen.getByRole("button", { name: "Play comparison" }).click();
}

describe("VideoCompareSlider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders both video elements with their given src and alt", () => {
    const { container } = renderSlider();
    const videos = container.querySelectorAll("video");
    expect(videos).toHaveLength(2);
    expect(videos[0]).toHaveAttribute("src", RIGHT_SRC);
    expect(videos[0]).toHaveAttribute("aria-label", "Enemy's POV");
    expect(videos[0]).toHaveAttribute("preload", "none");
    expect(videos[1]).toHaveAttribute("src", LEFT_SRC);
    expect(videos[1]).toHaveAttribute("aria-label", "Peeker's POV");
  });

  it("shows a play affordance and no loading state before starting", () => {
    renderSlider();
    expect(screen.getByRole("button", { name: "Play comparison" })).toBeInTheDocument();
    expect(screen.queryByText("Loading video...")).not.toBeInTheDocument();
  });

  it("shows a loading state after starting, until both clips can play", () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const { container } = renderSlider();

    act(() => {
      clickPlay();
    });

    const [right, left] = Array.from(container.querySelectorAll("video"));
    act(() => {
      right?.dispatchEvent(new Event("loadstart"));
      left?.dispatchEvent(new Event("loadstart"));
    });
    expect(screen.getByText("Loading video...")).toBeInTheDocument();

    act(() => {
      right?.dispatchEvent(new Event("canplay"));
    });
    expect(screen.getByText("Loading video...")).toBeInTheDocument();

    act(() => {
      left?.dispatchEvent(new Event("canplay"));
    });
    expect(screen.queryByText("Loading video...")).not.toBeInTheDocument();
  });

  it("shows an error state when either clip fails", () => {
    const { container } = renderSlider();
    const [right] = Array.from(container.querySelectorAll("video"));

    act(() => {
      right?.dispatchEvent(new Event("error"));
    });
    expect(screen.getByText("Video failed to load")).toBeInTheDocument();
  });

  it("renders a caption when provided", () => {
    renderSlider({ caption: "Same peek, both perspectives." });
    expect(screen.getByText("Same peek, both perspectives.")).toBeInTheDocument();
  });

  it("renders left/right labels when provided, and omits them otherwise", () => {
    const { rerender } = renderSlider();
    expect(screen.queryByText("Peeker")).not.toBeInTheDocument();
    expect(screen.queryByText("Enemy")).not.toBeInTheDocument();

    rerender(
      <VideoCompareSlider
        leftSrc={LEFT_SRC}
        rightSrc={RIGHT_SRC}
        leftAlt="Peeker's POV"
        rightAlt="Enemy's POV"
        leftLabel="Peeker"
        rightLabel="Enemy"
      />,
    );
    expect(screen.getByText("Peeker")).toBeInTheDocument();
    expect(screen.getByText("Enemy")).toBeInTheDocument();
  });

  describe("side-by-side toggle", () => {
    it("starts in overlay mode, with the divider slider present", () => {
      renderSlider();
      expect(screen.getByRole("slider", { name: "Comparison position" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Show both videos side by side" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("switches to side-by-side mode and hides the divider, then switches back", () => {
      renderSlider();
      const toggle = screen.getByRole("button", { name: "Show both videos side by side" });

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
      expect(screen.getByRole("button", { name: "Show both videos side by side" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("keeps the same video elements across a toggle, rather than remounting them", () => {
      const { container } = renderSlider();
      const videosBefore = Array.from(container.querySelectorAll("video"));

      act(() => {
        screen.getByRole("button", { name: "Show both videos side by side" }).click();
      });

      const videosAfter = Array.from(container.querySelectorAll("video"));
      expect(videosAfter).toEqual(videosBefore);
    });

    it("is usable before playback starts, without triggering the play affordance", () => {
      const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
      renderSlider();

      act(() => {
        screen.getByRole("button", { name: "Show both videos side by side" }).click();
      });
      expect(play).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Play comparison" })).toBeInTheDocument();
    });
  });

  it("exposes an ARIA slider starting at 50, before any playback starts", () => {
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

  describe("click-to-play", () => {
    it("never plays from visibility alone - only a direct click starts both clips", () => {
      const observer = installCapturingIntersectionObserver();
      const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

      renderSlider();

      act(() => {
        observer.fireForThreshold(AUTOPLAY_THRESHOLD, true);
      });
      expect(play).not.toHaveBeenCalled();

      observer.restore();
    });

    it("starts both clips together when the shared play affordance is clicked", () => {
      const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

      renderSlider();

      act(() => {
        clickPlay();
      });
      expect(play).toHaveBeenCalledTimes(2);
    });

    it("pauses both clips on scroll-away and resumes both on scroll-back once started", () => {
      const observer = installCapturingIntersectionObserver();
      const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
      const pause = vi
        .spyOn(HTMLMediaElement.prototype, "pause")
        .mockImplementation(() => undefined);

      renderSlider();

      act(() => {
        clickPlay();
      });
      expect(play).toHaveBeenCalledTimes(2);
      play.mockClear();
      // Not yet visible (the observer hasn't reported an intersection yet),
      // so starting playback alone pauses both (already-paused) clips via
      // the visibility effect - clear that incidental call before asserting
      // on the deliberate one below.
      pause.mockClear();

      act(() => {
        observer.fireForThreshold(AUTOPLAY_THRESHOLD, true);
      });
      play.mockClear();

      act(() => {
        observer.fireForThreshold(AUTOPLAY_THRESHOLD, false);
      });
      expect(pause).toHaveBeenCalledTimes(2);

      act(() => {
        observer.fireForThreshold(AUTOPLAY_THRESHOLD, true);
      });
      expect(play).toHaveBeenCalledTimes(2);

      observer.restore();
    });

    it("restarts both clips together when either one ends", () => {
      const observer = installCapturingIntersectionObserver();
      vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
      vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);

      const { container } = renderSlider();
      const [right, left] = Array.from(container.querySelectorAll("video"));
      if (!right || !left) throw new Error("videos not rendered");
      right.currentTime = 3;
      left.currentTime = 3;

      act(() => {
        clickPlay();
        observer.fireForThreshold(AUTOPLAY_THRESHOLD, true);
      });

      act(() => {
        left.dispatchEvent(new Event("ended"));
      });
      expect(right.currentTime).toBe(0);
      expect(left.currentTime).toBe(0);

      observer.restore();
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
      // Not yet - the reveal is delayed, not synchronous with full visibility.
      expect(slider).toHaveAttribute("aria-valuenow", "50");

      act(() => {
        vi.runAllTimers();
      });
      expect(slider).toHaveAttribute("aria-valuenow", "88");

      observer.restore();
    });

    it("eases the divider to the reveal position even when playback is never started", () => {
      const observer = installCapturingIntersectionObserver();

      renderSlider();

      act(() => {
        observer.fireForThreshold(INTRO_THRESHOLD, true);
      });
      act(() => {
        vi.runAllTimers();
      });
      const slider = screen.getByRole("slider", { name: "Comparison position" });
      expect(slider).toHaveAttribute("aria-valuenow", "88");

      observer.restore();
    });

    it("replays the reveal every time the card re-enters full view, not just the first", () => {
      const observer = installCapturingIntersectionObserver();

      renderSlider();
      const slider = screen.getByRole("slider", { name: "Comparison position" });

      act(() => {
        observer.fireForThreshold(AUTOPLAY_THRESHOLD, true);
        observer.fireForThreshold(INTRO_THRESHOLD, true);
      });
      act(() => {
        vi.runAllTimers();
      });
      expect(slider).toHaveAttribute("aria-valuenow", "88");

      // Scrolls away (past `AUTOPLAY_THRESHOLD`, e.g. to a second video
      // further down the page) - the divider resets to center so there's
      // something to reveal again on the way back.
      act(() => {
        observer.fireForThreshold(INTRO_THRESHOLD, false);
        observer.fireForThreshold(AUTOPLAY_THRESHOLD, false);
      });
      expect(slider).toHaveAttribute("aria-valuenow", "50");

      // Scrolls back into full view - the reveal replays.
      act(() => {
        observer.fireForThreshold(AUTOPLAY_THRESHOLD, true);
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
        observer.fireForThreshold(AUTOPLAY_THRESHOLD, true);
        observer.fireForThreshold(INTRO_THRESHOLD, true);
      });
      act(() => {
        vi.runAllTimers();
      });
      const slider = screen.getByRole("slider", { name: "Comparison position" });
      expect(slider).toHaveAttribute("aria-valuenow", "88");

      // User drags back to 0, then scrolls away and back into full view again.
      act(() => {
        slider.focus();
        slider.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
      });
      expect(slider).toHaveAttribute("aria-valuenow", "0");

      act(() => {
        observer.fireForThreshold(AUTOPLAY_THRESHOLD, false);
      });
      // Not reset to 50 - the reader positioned this on purpose.
      expect(slider).toHaveAttribute("aria-valuenow", "0");

      act(() => {
        observer.fireForThreshold(AUTOPLAY_THRESHOLD, true);
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
