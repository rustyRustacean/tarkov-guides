import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Lightbox } from "./Lightbox";

import type { WikiImage } from "@/shared/lib/wiki/fetch-wiki";

const IMAGES: readonly WikiImage[] = [
  {
    src: "https://static.wikia.nocookie.net/x/images/a/Map.png/revision/latest?cb=1",
    caption: "Location marked on map",
  },
  {
    src: "https://static.wikia.nocookie.net/x/images/b/Building.png/revision/latest?cb=2",
    caption: "The building",
  },
  {
    src: "https://static.wikia.nocookie.net/x/images/c/Stairs.png/revision/latest?cb=3",
    caption: "The staircase",
  },
];

describe("Lightbox", () => {
  it("renders nothing open when index is null", () => {
    render(<Lightbox images={IMAGES} index={null} onIndexChange={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the image, caption, and position counter for the given index", () => {
    render(<Lightbox images={IMAGES} index={1} onIndexChange={vi.fn()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The building" })).toBeInTheDocument();
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByAltText("The building")).toHaveAttribute(
      "src",
      "https://static.wikia.nocookie.net/x/images/b/Building.png/revision/latest?cb=2",
    );
  });

  it("prefixes the title with the image's section when it has one", () => {
    const sectioned = [{ ...IMAGES[0], section: "Utyos" }, IMAGES[1]] as readonly WikiImage[];
    render(<Lightbox images={sectioned} index={0} onIndexChange={vi.fn()} />);
    expect(
      screen.getByRole("heading", { name: "Utyos · Location marked on map" }),
    ).toBeInTheDocument();
  });

  it("falls back to a generic title when an image has neither caption nor section", () => {
    const blank = [{ src: "https://cdn/x.png", caption: "" }] as readonly WikiImage[];
    render(<Lightbox images={blank} index={0} onIndexChange={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "Screenshot" })).toBeInTheDocument();
  });

  it("links 'Open' to the image src", () => {
    render(<Lightbox images={IMAGES} index={0} onIndexChange={vi.fn()} />);
    expect(screen.getByRole("link", { name: /open/i })).toHaveAttribute(
      "href",
      "https://static.wikia.nocookie.net/x/images/a/Map.png/revision/latest?cb=1",
    );
  });

  it("cycles forward and wraps around via the Next button", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    render(<Lightbox images={IMAGES} index={2} onIndexChange={onIndexChange} />);

    await user.click(screen.getByRole("button", { name: "Next image" }));
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it("cycles backward and wraps around via the Previous button", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    render(<Lightbox images={IMAGES} index={0} onIndexChange={onIndexChange} />);

    await user.click(screen.getByRole("button", { name: "Previous image" }));
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it("navigates via the ArrowLeft/ArrowRight keys while open", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    render(<Lightbox images={IMAGES} index={0} onIndexChange={onIndexChange} />);

    await user.keyboard("{ArrowRight}");
    expect(onIndexChange).toHaveBeenCalledWith(1);

    await user.keyboard("{ArrowLeft}");
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it("jumps directly to an image via its thumbnail in the filmstrip", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    render(<Lightbox images={IMAGES} index={0} onIndexChange={onIndexChange} />);

    await user.click(screen.getByRole("button", { name: /show image 3: the staircase/i }));
    expect(onIndexChange).toHaveBeenCalledWith(2);
  });

  it("calls onIndexChange(null) when the dialog is dismissed", async () => {
    const user = userEvent.setup();
    const onIndexChange = vi.fn();
    render(<Lightbox images={IMAGES} index={0} onIndexChange={onIndexChange} />);

    await user.keyboard("{Escape}");
    expect(onIndexChange).toHaveBeenCalledWith(null);
  });

  it("hides prev/next controls and the thumbnail filmstrip when there's only one image", () => {
    const single = [IMAGES[0]] as readonly WikiImage[];
    render(<Lightbox images={single} index={0} onIndexChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Next image" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Previous image" })).not.toBeInTheDocument();
    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
  });

  it("sets referrerPolicy=no-referrer on every rendered image, so Fandom's anti-hotlink protection never 404s them", () => {
    render(<Lightbox images={IMAGES} index={0} onIndexChange={vi.fn()} />);
    for (const img of screen.getAllByRole("img")) {
      expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
    }
  });

  describe("crossfade on image change", () => {
    beforeEach(() => {
      vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
        cb(0);
        return 0;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("keeps the previous image visible, faded in behind the incoming one, until it loads", () => {
      const { rerender } = render(<Lightbox images={IMAGES} index={0} onIndexChange={vi.fn()} />);
      expect(screen.getByAltText("Location marked on map")).toBeInTheDocument();

      rerender(<Lightbox images={IMAGES} index={1} onIndexChange={vi.fn()} />);

      expect(screen.getByAltText("Location marked on map")).toBeInTheDocument();
      expect(screen.getByAltText("The building")).toHaveClass("opacity-0");
    });

    it("fades the incoming image to full opacity once it loads, then swaps it in as the sole image", () => {
      const { rerender } = render(<Lightbox images={IMAGES} index={0} onIndexChange={vi.fn()} />);
      rerender(<Lightbox images={IMAGES} index={1} onIndexChange={vi.fn()} />);

      const incoming = screen.getByAltText("The building");
      fireEvent.load(incoming);
      expect(incoming).toHaveClass("opacity-100");

      fireEvent.transitionEnd(incoming);

      expect(screen.queryByAltText("Location marked on map")).not.toBeInTheDocument();
      expect(screen.getByAltText("The building")).toBeInTheDocument();
    });
  });
});
