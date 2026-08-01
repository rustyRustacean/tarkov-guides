import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PVP_CONDENSED_GUIDE } from "../lib/pvp-condensed-guide";

import { CondensedGuide } from "./CondensedGuide";

// `TransitionLink` calls `useRouter()`, which throws outside a real Next.js App Router tree.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("CondensedGuide", () => {
  it("renders every real condensed-guide section's title", () => {
    render(<CondensedGuide />);
    for (const section of PVP_CONDENSED_GUIDE) {
      // `getByRole("heading", ...)`, not `getByText` - some titles (e.g.
      // "Gathering Intel") also appear as inline cross-chapter links inside
      // other sections' key takeaways, which `getByText` would double-match.
      expect(screen.getByRole("heading", { name: section.title })).toBeInTheDocument();
    }
  });

  it("renders the right number of <video> elements for every section's video block (1 for a single videoPath, 2 for a videoCompare pair)", () => {
    const { container } = render(<CondensedGuide />);
    const expectedVideoCount = PVP_CONDENSED_GUIDE.reduce((total, section) => {
      if (section.videoCompare) return total + 2;
      if (section.videoPath) return total + 1;
      return total;
    }, 0);
    expect(container.querySelectorAll("video")).toHaveLength(expectedVideoCount);
  });
});
