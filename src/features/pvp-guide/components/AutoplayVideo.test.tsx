import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { installCapturingIntersectionObserver } from "@/test/intersection-observer";

import { AutoplayVideo } from "./AutoplayVideo";

/** Fires `canplay` so the component leaves its initial loading state, a prerequisite for the play/pause effect to act at all. */
function markCanPlay(video: HTMLVideoElement) {
  video.dispatchEvent(new Event("canplay"));
}

describe("AutoplayVideo", () => {
  it("renders a video element with the given src and a loading state initially", () => {
    const { container } = render(
      <AutoplayVideo src="/videos/pvp-guide/a-d-strafing-comparison.webm" alt="Test clip" />,
    );
    const video = container.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("src", "/videos/pvp-guide/a-d-strafing-comparison.webm");
    expect(screen.getByText("Loading video...")).toBeInTheDocument();
  });

  it("shows an error state when the video fails to load", async () => {
    const { container } = render(<AutoplayVideo src="/does-not-exist.webm" alt="Broken clip" />);
    const video = container.querySelector("video");
    expect(video).toBeInTheDocument();
    video?.dispatchEvent(new Event("error"));
    expect(await screen.findByText("Video failed to load")).toBeInTheDocument();
  });

  it("renders a caption when provided", () => {
    render(
      <AutoplayVideo
        src="/videos/pvp-guide/a-d-strafing-comparison.webm"
        alt="Test clip"
        caption="A real caption"
      />,
    );
    expect(screen.getByText("A real caption")).toBeInTheDocument();
  });

  it("tags its root figure with the given videoId", () => {
    const { container } = render(
      <AutoplayVideo
        src="/videos/pvp-guide/a-d-strafing-comparison.webm"
        alt="Test clip"
        videoId="custom-id"
      />,
    );
    expect(container.querySelector('[data-video-id="custom-id"]')).toBeInTheDocument();
  });

  describe("visibility-gated playback", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("only plays once both ready and on screen, and pauses again once scrolled off screen", () => {
      const observer = installCapturingIntersectionObserver();
      const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
      const pause = vi
        .spyOn(HTMLMediaElement.prototype, "pause")
        .mockImplementation(() => undefined);

      const { container } = render(
        <AutoplayVideo src="/videos/pvp-guide/a-d-strafing-comparison.webm" alt="Test clip" />,
      );
      const video = container.querySelector("video");
      if (!video) throw new Error("video not rendered");

      act(() => {
        markCanPlay(video);
      });
      expect(play).not.toHaveBeenCalled();

      act(() => {
        observer.fire(true);
      });
      expect(play).toHaveBeenCalledTimes(1);

      act(() => {
        observer.fire(false);
      });
      expect(pause).toHaveBeenCalled();

      observer.restore();
    });

    it("doesn't resume playback on scroll-back-into-view after the user explicitly paused it", () => {
      const observer = installCapturingIntersectionObserver();
      const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
      vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);

      const { container } = render(
        <AutoplayVideo src="/videos/pvp-guide/a-d-strafing-comparison.webm" alt="Test clip" />,
      );
      const video = container.querySelector("video");
      if (!video) throw new Error("video not rendered");

      act(() => {
        markCanPlay(video);
        observer.fire(true);
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
