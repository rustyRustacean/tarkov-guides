import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PvpTutorialPage } from "./PvpTutorialPage";

import type { LearningPathItemWithTutorial } from "../lib/pvp-learning-path";
import type { PvpTutorial } from "../types";

// `TransitionLink` calls `useRouter()`, which throws outside a real Next.js App Router tree.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function makeTutorial(overrides: Partial<PvpTutorial> = {}): PvpTutorial {
  return {
    slug: "pvp1",
    frontmatter: {
      title: "Understanding Tarkov Movement",
      description: "Test description",
      difficulty: "beginner",
      publishedAt: "2025-01-01",
      updatedAt: "2025-01-01",
      gameVersion: "0.15.0",
      tags: ["movement", "inertia"],
      order: 1,
    },
    content: "",
    readingTimeMinutes: 5,
    wordCount: 1000,
    ...overrides,
  };
}

function makeNavItem(slug: string, title: string): LearningPathItemWithTutorial {
  return {
    tutorialSlug: slug,
    order: 1,
    tier: "essential",
    estimatedTime: 30,
    description: "desc",
    tutorial: makeTutorial({ slug, frontmatter: { ...makeTutorial().frontmatter, title } }),
  };
}

describe("PvpTutorialPage", () => {
  it("renders the title, difficulty, reading time, tags, and MDX content", () => {
    render(
      <PvpTutorialPage
        tutorial={makeTutorial()}
        content={<p>Compiled MDX body</p>}
        previous={null}
        next={null}
        progress={{ current: 1, total: 6, percentage: 17 }}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Understanding Tarkov Movement" }),
    ).toBeInTheDocument();
    expect(screen.getByText("beginner")).toBeInTheDocument();
    expect(screen.getByText("Tutorial 1 of 6")).toBeInTheDocument();
    expect(screen.getByText("movement")).toBeInTheDocument();
    expect(screen.getByText("Compiled MDX body")).toBeInTheDocument();
  });

  it("renders previous/next nav links when present, and always a back-to-guide link", () => {
    render(
      <PvpTutorialPage
        tutorial={makeTutorial()}
        content={<p>Body</p>}
        previous={makeNavItem("pvp0", "Prior Tutorial")}
        next={makeNavItem("pvp3", "Next Tutorial")}
        progress={{ current: 2, total: 6, percentage: 33 }}
      />,
    );
    expect(screen.getByRole("link", { name: /Prior Tutorial/ })).toHaveAttribute(
      "href",
      "/pvp-guide/pvp0",
    );
    expect(screen.getByRole("link", { name: /Next Tutorial/ })).toHaveAttribute(
      "href",
      "/pvp-guide/pvp3",
    );
    expect(screen.getByRole("link", { name: "Back to PvP Guide" })).toHaveAttribute(
      "href",
      "/pvp-guide",
    );
  });

  it("omits previous/next links when at either end of the path", () => {
    render(
      <PvpTutorialPage
        tutorial={makeTutorial()}
        content={<p>Body</p>}
        previous={null}
        next={null}
        progress={{ current: 1, total: 6, percentage: 17 }}
      />,
    );
    expect(screen.queryByText(/Previous/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Next$/)).not.toBeInTheDocument();
  });
});
