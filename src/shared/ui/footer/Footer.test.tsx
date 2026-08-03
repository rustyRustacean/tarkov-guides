import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Footer } from "./Footer";

// `TransitionLink` (used by the "Credits" link) calls `useRouter()`, which throws outside a real Next.js App Router tree.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Footer", () => {
  it("renders the community disclaimer", () => {
    render(<Footer />);
    expect(
      screen.getByText("Built for the Tarkov community. Not affiliated with Battlestate Games."),
    ).toBeInTheDocument();
  });

  it("renders the Credits link pointing at /credits", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Credits" })).toHaveAttribute("href", "/credits");
  });

  it("renders the Privacy link pointing at /privacy", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });
});
