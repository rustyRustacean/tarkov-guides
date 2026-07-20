import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SkipToVideo } from "./SkipToVideo";

describe("SkipToVideo", () => {
  it("renders a Jump to Video CTA", () => {
    render(<SkipToVideo />);
    expect(screen.getByRole("button", { name: "Jump to Video" })).toBeInTheDocument();
  });

  it("scrolls the data-video-id target into view on click", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(
      <>
        <SkipToVideo />
        <div data-video-id="tutorial-video" />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Jump to Video" }));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
  });

  it("scrolls to the first data-video-id target, not a later one", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    render(
      <>
        <SkipToVideo />
        <div data-video-id="first" />
        <div data-video-id="second" />
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Jump to Video" }));

    expect(scrollIntoView.mock.contexts[0]).toHaveAttribute("data-video-id", "first");
  });

  it("is a harmless no-op when no video target exists on the page", async () => {
    render(<SkipToVideo />);
    await userEvent.click(screen.getByRole("button", { name: "Jump to Video" }));
    // No throw = pass.
  });
});
