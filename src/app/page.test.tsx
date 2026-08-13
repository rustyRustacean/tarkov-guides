import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "./page";

// The hero animation needs a real canvas/rAF environment (see
// `RiverHero.test.tsx`, which covers its behavior directly). Mocked here so
// this test stays focused on the homepage's static content/links, not canvas
// internals.
vi.mock("@/features/home/components/RiverHero", () => ({
  RiverHero: () => null,
}));

// `TransitionLink` calls `useRouter()`, which throws outside a real Next.js
// App Router tree. Mocked here the same way `Header.test.tsx` does.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Home", () => {
  it("renders the hero heading and primary CTA", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /master.*escape from tarkov/i, level: 1 }),
    ).toBeInTheDocument();

    const primaryCta = screen.getByRole("link", { name: "Open PvP Guide" });
    expect(primaryCta).toHaveAttribute("href", "/pvp-guide");
  });

  it("links the Progress Tracker feature card to the real route", () => {
    render(<Home />);

    const cardLink = screen.getByRole("link", { name: "Open Progress Tracker →" });
    expect(cardLink).toHaveAttribute("href", "/progress-tracker");
  });

  it("links the PvP Guide feature card to the real route", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "PvP Guide" })).toBeInTheDocument();
    const cardLink = screen.getByRole("link", { name: "Open PvP Guide →" });
    expect(cardLink).toHaveAttribute("href", "/pvp-guide");
  });

  it("links the Maps feature card to the real route", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "Maps" })).toBeInTheDocument();
    const cardLink = screen.getByRole("link", { name: "Open Maps →" });
    expect(cardLink).toHaveAttribute("href", "/maps");
  });

  // Disabled per user request; the three coming-soon cards themselves are
  // commented out in `page.tsx` (see `COMING_SOON_FEATURES`' doc comment
  // there), so this is commented out alongside them rather than deleted, to
  // restore easily whenever they come back.
  // it("renders every coming-soon feature as an inert, disabled action (not a link)", () => {
  //   render(<Home />);
  //
  //   for (const title of ["10 Quick Tips", "Ballistics Calculator", "Flea Market Tools"]) {
  //     expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
  //   }
  //
  //   const comingSoonButtons = screen.getAllByRole("button", { name: "Coming Soon" });
  //   expect(comingSoonButtons).toHaveLength(3);
  //   comingSoonButtons.forEach((button) => {
  //     expect(button).toBeDisabled();
  //   });
  //
  //   // None of the coming-soon cards should render as navigable links.
  //   expect(screen.queryAllByRole("link", { name: "Coming Soon" })).toHaveLength(0);
  // });
});
