import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { getGuideSource } from "../../data/guide-sources";

import { GuideSources } from "./GuideSources";

import type { SourcedCitation } from "../../lib/guide-citations";

/** A citation of a real registered source, as `compileGuideChapter` hands it over. */
function cite(id: string, number: number, timestamps: readonly string[] = []): SourcedCitation {
  const source = getGuideSource(id);
  if (!source) throw new Error(`unknown test source ${id}`);
  return { id, number, timestamps, source };
}

describe("GuideSources", () => {
  it("lists each cited source under its number, with creator, title and date", () => {
    render(
      <GuideSources
        citations={[cite("jbobyh-bot-vision", 1, ["1:19"]), cite("jbobyh-frame-rate", 2)]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Sources" })).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute("id", "source-1");
    expect(items[1]).toHaveAttribute("id", "source-2");

    const [firstItem] = items;
    if (!firstItem) throw new Error("expected a first source");
    const first = within(firstItem);
    expect(first.getByRole("link", { name: "jbobyh" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/@jbobyh",
    );
    expect(first.getByRole("link", { name: /Bot vision/ })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=IkuoU6jyRBo",
    );
    expect(items[0]).toHaveTextContent("10 Nov 2026");
  });

  it("links every cited timestamp to that second of the video", () => {
    render(<GuideSources citations={[cite("jbobyh-bot-vision", 1, ["1:19", "6:10"])]} />);

    expect(screen.getByRole("link", { name: "1:19" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=IkuoU6jyRBo&t=79s",
    );
    expect(screen.getByRole("link", { name: "6:10" })).toHaveAttribute(
      "href",
      "https://www.youtube.com/watch?v=IkuoU6jyRBo&t=370s",
    );
  });

  it("notes translated sources and leaves English ones alone", () => {
    render(
      <GuideSources citations={[cite("jbobyh-bot-vision", 1), cite("jbobyh-frame-rate", 2)]} />,
    );

    const [russian, english] = screen.getAllByRole("listitem");
    expect(russian).toHaveTextContent("Translated from Russian.");
    expect(english).not.toHaveTextContent("Translated from Russian.");
  });

  it("opens every link in a new tab without passing on the opener", () => {
    render(<GuideSources citations={[cite("jbobyh-bot-vision", 1, ["1:19"])]} />);

    for (const link of screen.getAllByRole("link")) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
  });

  it("renders nothing without citations", () => {
    const { container } = render(<GuideSources citations={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
