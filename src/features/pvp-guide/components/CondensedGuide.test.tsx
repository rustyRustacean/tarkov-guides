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

  it("renders exactly one video block, on the circle-strafing section only", () => {
    const { container } = render(<CondensedGuide />);
    expect(container.querySelectorAll("video")).toHaveLength(1);
  });
});
