import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AutoplayVideo } from "./AutoplayVideo";

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

  it("tags its root figure with the given videoId for SkipToVideo to target", () => {
    const { container } = render(
      <AutoplayVideo
        src="/videos/pvp-guide/a-d-strafing-comparison.webm"
        alt="Test clip"
        videoId="custom-id"
      />,
    );
    expect(container.querySelector('[data-video-id="custom-id"]')).toBeInTheDocument();
  });
});
