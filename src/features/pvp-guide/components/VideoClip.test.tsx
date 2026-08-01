import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installCapturingIntersectionObserver } from "@/test/intersection-observer";

import { VideoClip } from "./VideoClip";

const SRC = "/videos/pvp-guide/a-d-strafing-comparison.webm";

describe("VideoClip", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders a video element with the given src and a play affordance, without loading anything yet", () => {
    const { container } = render(<VideoClip src={SRC} alt="Test clip" />);
    const video = container.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("src", SRC);
    expect(video).toHaveAttribute("preload", "none");
    expect(screen.getByRole("button", { name: "Play video: Test clip" })).toBeInTheDocument();
    expect(screen.queryByText("Loading video...")).not.toBeInTheDocument();
  });

  it("shows an error state when the video fails to load", async () => {
    const { container } = render(<VideoClip src="/does-not-exist.webm" alt="Broken clip" />);
    const video = container.querySelector("video");
    expect(video).toBeInTheDocument();
    video?.dispatchEvent(new Event("error"));
    expect(await screen.findByText("Video failed to load")).toBeInTheDocument();
  });

  it("renders a caption when provided", () => {
    render(<VideoClip src={SRC} alt="Test clip" caption="A real caption" />);
    expect(screen.getByText("A real caption")).toBeInTheDocument();
  });

  it("tags its root figure with the given videoId", () => {
    const { container } = render(<VideoClip src={SRC} alt="Test clip" videoId="custom-id" />);
    expect(container.querySelector('[data-video-id="custom-id"]')).toBeInTheDocument();
  });

  it("renders without a background image on the play cover when no poster is given", () => {
    render(<VideoClip src={SRC} alt="Test clip" />);
    const cover = screen.getByRole("button", { name: "Play video: Test clip" });
    expect(cover.style.backgroundImage).toBe("");
  });

  it("forwards a given poster to the video element and the play cover", () => {
    const { container } = render(
      <VideoClip src={SRC} alt="Test clip" poster="/images/test-poster.jpg" />,
    );
    const video = container.querySelector("video");
    expect(video).toHaveAttribute("poster", "/images/test-poster.jpg");
    const cover = screen.getByRole("button", { name: "Play video: Test clip" });
    expect(cover.style.backgroundImage).toContain("test-poster.jpg");
  });

  describe("click-to-play", () => {
    it("never plays from visibility alone - only a direct click starts it", () => {
      const observer = installCapturingIntersectionObserver();
      const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

      render(<VideoClip src={SRC} alt="Test clip" />);

      act(() => {
        observer.fire(true);
      });
      expect(play).not.toHaveBeenCalled();

      observer.restore();
    });

    it("a click elsewhere on the page never starts playback", () => {
      const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

      render(<VideoClip src={SRC} alt="Test clip" />);

      act(() => {
        document.body.click();
      });
      expect(play).not.toHaveBeenCalled();
    });

    it("starts playback when the play affordance is clicked, and removes the cover", () => {
      const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);

      render(<VideoClip src={SRC} alt="Test clip" />);

      act(() => {
        screen.getByRole("button", { name: "Play video: Test clip" }).click();
      });
      expect(play).toHaveBeenCalledTimes(1);
      expect(
        screen.queryByRole("button", { name: "Play video: Test clip" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("visibility behavior after starting", () => {
    it("pauses on scroll-away and resumes on scroll-back once started", () => {
      const observer = installCapturingIntersectionObserver();
      const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
      const pause = vi
        .spyOn(HTMLMediaElement.prototype, "pause")
        .mockImplementation(() => undefined);

      render(<VideoClip src={SRC} alt="Test clip" />);

      act(() => {
        screen.getByRole("button", { name: "Play video: Test clip" }).click();
      });
      expect(play).toHaveBeenCalled();
      play.mockClear();

      act(() => {
        observer.fire(true);
      });
      act(() => {
        observer.fire(false);
      });
      expect(pause).toHaveBeenCalled();

      act(() => {
        observer.fire(true);
      });
      expect(play).toHaveBeenCalled();

      observer.restore();
    });

    it("doesn't resume playback on scroll-back-into-view after the user explicitly paused it", () => {
      const observer = installCapturingIntersectionObserver();
      const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
      vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);

      const { container } = render(<VideoClip src={SRC} alt="Test clip" />);
      const video = container.querySelector("video");
      if (!video) throw new Error("video not rendered");

      act(() => {
        screen.getByRole("button", { name: "Play video: Test clip" }).click();
      });
      expect(play).toHaveBeenCalledTimes(1);

      act(() => {
        video.dispatchEvent(new Event("play"));
      });
      act(() => {
        screen.getByRole("button", { name: "Pause video" }).click();
      });

      act(() => {
        observer.fire(false);
        observer.fire(true);
      });
      expect(play).toHaveBeenCalledTimes(1);

      observer.restore();
    });
  });
});
