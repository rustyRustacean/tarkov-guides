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

function markBothCanPlay(container: HTMLElement) {
  const videos = container.querySelectorAll("video");
  videos.forEach((video) => {
    video.dispatchEvent(new Event("canplay"));
  });
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
    expect(videos[1]).toHaveAttribute("src", LEFT_SRC);
    expect(videos[1]).toHaveAttribute("aria-label", "Peeker's POV");
  });

  it("shows a loading state until both clips can play", () => {
    const { container } = renderSlider();
    expect(screen.getByText("Loading video...")).toBeInTheDocument();

    const [right, left] = Array.from(container.querySelectorAll("video"));
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
    const { container, rerender } = renderSlider();
    act(() => {
      markBothCanPlay(container);
    });
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

  it("exposes an ARIA slider starting at 50", () => {
    const { container } = renderSlider();
    act(() => {
      markBothCanPlay(container);
    });
    const slider = screen.getByRole("slider", { name: "Comparison position" });
    expect(slider).toHaveAttribute("aria-valuemin", "0");
    expect(slider).toHaveAttribute("aria-valuemax", "100");
    expect(slider).toHaveAttribute("aria-valuenow", "50");
  });

  describe("keyboard interaction", () => {
    function getSlider(container: HTMLElement) {
      act(() => {
        markBothCanPlay(container);
      });
      return screen.getByRole("slider", { name: "Comparison position" });
    }

    it("nudges right on ArrowRight and left on ArrowLeft", () => {
      const { container } = renderSlider();
      const slider = getSlider(container);

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
      const { container } = renderSlider();
      const slider = getSlider(container);

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
      const { container } = renderSlider();
      const slider = getSlider(container);

      act(() => {
        slider.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
      });
      expect(slider).toHaveAttribute("aria-valuenow", "50");
    });
  });

  describe("visibility-gated synced playback", () => {
    it("only plays once both clips are ready and on screen, and pauses both when scrolled off screen", () => {
      const observer = installCapturingIntersectionObserver();
      const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
      const pause = vi
        .spyOn(HTMLMediaElement.prototype, "pause")
        .mockImplementation(() => undefined);

      const { container } = renderSlider();
      act(() => {
        markBothCanPlay(container);
      });
      // Not yet visible (the observer hasn't reported an intersection yet),
      // so becoming ready alone pauses both (already-paused) clips - clear
      // that incidental call before asserting on the deliberate one below.
      expect(play).not.toHaveBeenCalled();
      pause.mockClear();

      act(() => {
        observer.fireForThreshold(AUTOPLAY_THRESHOLD, true);
      });
      expect(play).toHaveBeenCalledTimes(2);

      act(() => {
        observer.fireForThreshold(AUTOPLAY_THRESHOLD, false);
      });
      expect(pause).toHaveBeenCalledTimes(2);

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
        markBothCanPlay(container);
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
      vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
      vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);

      const { container } = renderSlider();
      act(() => {
        markBothCanPlay(container);
      });
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

    it("never re-triggers after the first fully-visible moment", () => {
      const observer = installCapturingIntersectionObserver();
      vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
      vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);

      const { container } = renderSlider();
      act(() => {
        markBothCanPlay(container);
      });
      act(() => {
        observer.fireForThreshold(INTRO_THRESHOLD, true);
      });
      act(() => {
        vi.runAllTimers();
      });
      const slider = screen.getByRole("slider", { name: "Comparison position" });
      expect(slider).toHaveAttribute("aria-valuenow", "88");

      // User drags back to 0, scrolls away and back into full view again.
      act(() => {
        slider.focus();
        slider.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
      });
      expect(slider).toHaveAttribute("aria-valuenow", "0");

      act(() => {
        observer.fireForThreshold(INTRO_THRESHOLD, false);
      });
      act(() => {
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
