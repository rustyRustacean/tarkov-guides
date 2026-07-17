import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TutorialTierSection } from "./TutorialTierSection";

import type { LearningPathItemWithTutorial } from "../lib/pvp-learning-path";

// `TransitionLink` calls `useRouter()`, which throws outside a real Next.js App Router tree.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function makeItem(
  overrides: Partial<LearningPathItemWithTutorial> = {},
): LearningPathItemWithTutorial {
  return {
    tutorialSlug: "pvp1",
    order: 1,
    tier: "essential",
    estimatedTime: 30,
    description: "Test description",
    tutorial: {
      slug: "pvp1",
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
    },
    ...overrides,
  };
}

describe("TutorialTierSection", () => {
  it("renders every tutorial's title, time, and difficulty as a link to its detail page", () => {
    render(<TutorialTierSection tier="essential" items={[makeItem()]} />);
    const link = screen.getByRole("link", { name: /Test Tutorial/ });
    expect(link).toHaveAttribute("href", "/pvp-guide/pvp1");
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("beginner")).toBeInTheDocument();
  });

  it("shows a Start Here CTA only for the essential tier", () => {
    render(<TutorialTierSection tier="essential" items={[makeItem()]} />);
    expect(screen.getByRole("link", { name: /Start Here/ })).toBeInTheDocument();
  });

  it("shows no Start Here CTA for intermediate/advanced tiers", () => {
    render(
      <TutorialTierSection tier="intermediate" items={[makeItem({ tier: "intermediate" })]} />,
    );
    expect(screen.queryByRole("link", { name: /Start Here/ })).not.toBeInTheDocument();
  });

  it("skips an item whose tutorial failed to resolve rather than crashing", () => {
    render(<TutorialTierSection tier="essential" items={[makeItem({ tutorial: undefined })]} />);
    expect(screen.queryByRole("link", { name: /Test Tutorial/ })).not.toBeInTheDocument();
  });
});
