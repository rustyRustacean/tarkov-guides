import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SkipToVideo } from "./SkipToVideo";

describe("SkipToVideo", () => {
  it("renders a Jump to Video CTA", () => {
    render(<SkipToVideo />);
    expect(screen.getByRole("button", { name: "Jump to Video" })).toBeInTheDocument();
  });

  it("scrolls the matching data-video-id target into view on click", async () => {
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

  it("is a harmless no-op when no matching video target exists on the page", async () => {
    render(<SkipToVideo videoId="nothing-here" />);
    await userEvent.click(screen.getByRole("button", { name: "Jump to Video" }));
    // No throw = pass.
  });
});
