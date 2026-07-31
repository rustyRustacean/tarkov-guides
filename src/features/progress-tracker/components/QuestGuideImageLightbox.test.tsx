import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { QuestGuideImageLightbox } from "./QuestGuideImageLightbox";

import type { QuestGuideImage } from "@/shared/data/quest-guide-images";

const IMAGES: readonly QuestGuideImage[] = [
  {
    src: "https://static.wikia.nocookie.net/x/images/a/Map.png/revision/latest/scale-to-width-down/311?cb=1",
    caption: "Location marked on map",
  },
  {
    src: "https://static.wikia.nocookie.net/x/images/b/Building.png/revision/latest/scale-to-width-down/450?cb=2",
    caption: "The building",
  },
  {
    src: "https://static.wikia.nocookie.net/x/images/c/Stairs.png/revision/latest/scale-to-width-down/450?cb=3",
    caption: "The staircase",
  },
];

describe("QuestGuideImageLightbox", () => {
  it("renders nothing open when index is null", () => {
    render(<QuestGuideImageLightbox images={IMAGES} index={null} onIndexChange={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the full-resolution image, caption, and position counter for the given index", () => {
    render(<QuestGuideImageLightbox images={IMAGES} index={1} onIndexChange={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The building" })).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    const image = screen.getByAltText("The building");
    expect(image).toHaveAttribute(
      "src",
      "https://static.wikia.nocookie.net/x/images/b/Building.png/revision/latest?cb=2",
    );
  });

  it("links 'Full size' to the full-resolution url, not the scaled thumbnail", () => {
    render(<QuestGuideImageLightbox images={IMAGES} index={0} onIndexChange={vi.fn()} />);
    expect(screen.getByRole("link", { name: /full size/i })).toHaveAttribute(
      "href",
      "https://static.wikia.nocookie.net/x/images/a/Map.png/revision/latest?cb=1",
    );
  });

  it("cycles forward and wraps around via the Next button", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    render(<QuestGuideImageLightbox images={IMAGES} index={2} onIndexChange={onIndexChange} />);

    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it("cycles backward and wraps around via the Previous button", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    render(<QuestGuideImageLightbox images={IMAGES} index={0} onIndexChange={onIndexChange} />);

    await user.click(screen.getByRole("button", { name: "Previous image" }));
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it("navigates via the ArrowLeft/ArrowRight keys while open", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    render(<QuestGuideImageLightbox images={IMAGES} index={0} onIndexChange={onIndexChange} />);

    await user.keyboard("{ArrowRight}");
    expect(onIndexChange).toHaveBeenCalledWith(1);

    await user.keyboard("{ArrowLeft}");
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it("jumps directly to an image via its thumbnail in the filmstrip", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    render(<QuestGuideImageLightbox images={IMAGES} index={0} onIndexChange={onIndexChange} />);

    await user.click(screen.getByRole("button", { name: /show image 3: the staircase/i }));
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it("calls onIndexChange(null) when the dialog is dismissed", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    render(<QuestGuideImageLightbox images={IMAGES} index={0} onIndexChange={onIndexChange} />);

    await user.keyboard("{Escape}");
    expect(onIndexChange).toHaveBeenCalledWith(null);
  });

  it("hides prev/next controls and the thumbnail filmstrip when there's only one image", () => {
    const single = [IMAGES[0]] as readonly QuestGuideImage[];
    render(<QuestGuideImageLightbox images={single} index={0} onIndexChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Next image" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous image" })).not.toBeInTheDocument();
    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
  });
});
