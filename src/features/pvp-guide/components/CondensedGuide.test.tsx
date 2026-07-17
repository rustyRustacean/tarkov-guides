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
      expect(screen.getByText(section.title)).toBeInTheDocument();
    }
  });

  it("renders exactly one video block, on pvp1's section only", () => {
    const { container } = render(<CondensedGuide />);
    expect(container.querySelectorAll("video")).toHaveLength(1);
  });
});
