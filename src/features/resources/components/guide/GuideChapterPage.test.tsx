import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getGuideSource } from "../../data/guide-sources";
import { requireHostedResource } from "../../lib/resource-metadata";

import { Cite } from "./Cite";
import { GuideChapterList } from "./GuideChapterList";
import { GuideChapterPage } from "./GuideChapterPage";

import type { GuideChapter } from "../../lib/guide-content";

// `TransitionLink` calls `useRouter()`, which throws outside a real Next.js App Router tree.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const guide = requireHostedResource("hidden-mechanics");
const hitboxes = (() => {
  const source = getGuideSource("jbobyh-hitboxes");
  if (!source) throw new Error("jbobyh-hitboxes is missing from GUIDE_SOURCES");
  return source;
})();

function makeChapter(slug: string, title: string): GuideChapter {
  return {
    slug,
    frontmatter: {
      title,
      description: `${title} description`,
      order: 1,
      publishedAt: "2026-11-27",
      updatedAt: "2026-11-27",
    },
    content: "",
    readingTimeMinutes: 4,
  };
}

function renderPage({
  previous = makeChapter("ai-vision", "How AI Sees You"),
  next = makeChapter("penetration", "Bullets, Cover and Wallbangs"),
  atEnds = false,
}: { previous?: GuideChapter; next?: GuideChapter; atEnds?: boolean } = {}) {
  render(
    <GuideChapterPage
      guide={guide}
      chapter={makeChapter("hitboxes-and-damage", "Hitboxes and Damage")}
      chapterNumber={2}
      content={
        <p>
          Bodies never ricochet. <Cite number={1} t="1:45" />
        </p>
      }
      citations={[{ id: "jbobyh-hitboxes", number: 1, timestamps: ["1:45"], source: hitboxes }]}
      previous={atEnds ? undefined : previous}
      next={atEnds ? undefined : next}
    />,
  );
}

describe("GuideChapterPage", () => {
  it("shows the chapter heading, number, reading time and updated date", () => {
    renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Hitboxes and Damage" })).toBeVisible();
    expect(screen.getByText("Chapter 2")).toBeInTheDocument();
    expect(screen.getByText("4 min read")).toBeInTheDocument();
    expect(screen.getByText("Updated 27 Nov 2026")).toBeInTheDocument();
  });

  it("breadcrumbs back through the guide to the hub", () => {
    renderPage();

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb).toHaveTextContent("Home/Resources/Hidden Mechanics/Hitboxes and Damage");
    expect(screen.getByRole("link", { name: "Hidden Mechanics" })).toHaveAttribute(
      "href",
      "/resources/hidden-mechanics",
    );
  });

  it("links an inline citation to its entry in the sources list", () => {
    renderPage();

    expect(screen.getByRole("link", { name: "Source 1, at 1:45" })).toHaveAttribute(
      "href",
      "#source-1",
    );
    expect(document.getElementById("source-1")).toHaveTextContent("Hitboxes and damage");
  });

  it("links the previous chapter, the guide and the next chapter", () => {
    renderPage();

    expect(screen.getByRole("link", { name: /Previous\s*How AI Sees You/ })).toHaveAttribute(
      "href",
      "/resources/hidden-mechanics/ai-vision",
    );
    expect(screen.getByRole("link", { name: "All chapters" })).toHaveAttribute(
      "href",
      "/resources/hidden-mechanics",
    );
    expect(
      screen.getByRole("link", { name: /Next\s*Bullets, Cover and Wallbangs/ }),
    ).toHaveAttribute("href", "/resources/hidden-mechanics/penetration");
  });

  it("leaves out previous and next at the ends of the guide", () => {
    renderPage({ atEnds: true });

    expect(screen.queryByRole("link", { name: /Previous/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Next/ })).not.toBeInTheDocument();
  });
});

describe("GuideChapterList", () => {
  it("lists chapters in order, numbered, each linking to its page", () => {
    render(
      <GuideChapterList
        guideSlug="hidden-mechanics"
        chapters={[
          makeChapter("ai-vision", "How AI Sees You"),
          makeChapter("frame-rate", "Frame Rate Quirks"),
        ]}
      />,
    );

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/resources/hidden-mechanics/ai-vision",
      "/resources/hidden-mechanics/frame-rate",
    ]);
    expect(links[0]).toHaveTextContent("1How AI Sees You");
    expect(links[1]).toHaveTextContent("2Frame Rate Quirks");
  });
});
