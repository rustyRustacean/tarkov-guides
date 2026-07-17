import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CondensedGuideSection } from "./CondensedGuideSection";

import type { CondensedGuideSection as CondensedGuideSectionData } from "../lib/pvp-condensed-guide";

// `TransitionLink` calls `useRouter()`, which throws outside a real Next.js App Router tree.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function makeSection(
  overrides: Partial<CondensedGuideSectionData> = {},
): CondensedGuideSectionData {
  return {
    tutorialSlug: "pvp1",
    order: 1,
    title: "Test Section",
    briefExplanation: "A brief explanation.",
    keyPoints: ["Point one", "Point two"],
    ...overrides,
  };
}

describe("CondensedGuideSection", () => {
  it("renders the title, explanation, key points, and a link to the full tutorial", () => {
    render(<CondensedGuideSection section={makeSection()} />);
    expect(screen.getByText("Test Section")).toBeInTheDocument();
    expect(screen.getByText("A brief explanation.")).toBeInTheDocument();
    expect(screen.getByText("Point one")).toBeInTheDocument();
    expect(screen.getByText("Point two")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Read full detailed guide/ })).toHaveAttribute(
      "href",
      "/pvp-guide/pvp1",
    );
  });

  it("renders no video block when videoPath is absent", () => {
    const { container } = render(<CondensedGuideSection section={makeSection()} />);
    expect(container.querySelector("video")).not.toBeInTheDocument();
  });

  it("renders a video block when videoPath is present", () => {
    const { container } = render(
      <CondensedGuideSection
        section={makeSection({ videoPath: "/videos/pvp-guide/a-d-strafing-comparison.webm" })}
      />,
    );
    expect(container.querySelector("video")).toBeInTheDocument();
  });
});
