import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FullGuideList } from "./FullGuideList";

import type { LearningPathItemWithTutorial } from "../lib/pvp-learning-path";
import type { PvpTutorial } from "../types";

// `TransitionLink` calls `useRouter()`, which throws outside a real Next.js App Router tree.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function makeTutorial(overrides: Partial<PvpTutorial> = {}): PvpTutorial {
  return {
    slug: "circle-strafing",
    frontmatter: {
      title: "Test Tutorial",
      description: "Test",
      difficulty: "beginner",
      publishedAt: "2025-01-01",
      updatedAt: "2025-01-01",
      gameVersion: "0.15.0",
      order: 1,
    },
    content: "",
    readingTimeMinutes: 5,
    wordCount: 1000,
    ...overrides,
  };
}

function makeItem(
  overrides: Partial<LearningPathItemWithTutorial> = {},
): LearningPathItemWithTutorial {
  return {
    tutorialSlug: "circle-strafing",
    order: 1,
    tier: "essential",
    estimatedTime: 30,
    description: "Test description",
    tutorial: makeTutorial(),
    ...overrides,
  };
}

describe("FullGuideList", () => {
  it("renders every item's title and order badge as a link to its detail page", () => {
    render(<FullGuideList items={[makeItem()]} />);
    const link = screen.getByRole("link", { name: /Test Tutorial/ });
    expect(link).toHaveAttribute("href", "/pvp-guide/circle-strafing");
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("renders every item in a flat list, no tier grouping headings", () => {
    render(
      <FullGuideList
        items={[
          makeItem({ tutorialSlug: "circle-strafing", order: 1 }),
          makeItem({
            tutorialSlug: "peeking-essentials",
            order: 2,
            tier: "intermediate",
            tutorial: makeTutorial({
              slug: "peeking-essentials",
              frontmatter: { ...makeTutorial().frontmatter, title: "Peeking Essentials" },
            }),
          }),
        ]}
      />,
    );
    expect(screen.getByRole("link", { name: /Test Tutorial/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Peeking Essentials/ })).toBeInTheDocument();
    const tierHeading = screen.queryByText(
      /Essential Foundation|Intermediate Mastery|Advanced Mastery/,
    );
    expect(tierHeading).not.toBeInTheDocument();
  });

  it("skips an item whose tutorial failed to resolve rather than crashing", () => {
    render(<FullGuideList items={[makeItem({ tutorial: undefined })]} />);
    expect(screen.queryByRole("link", { name: /Test Tutorial/ })).not.toBeInTheDocument();
  });
});
