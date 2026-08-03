import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreditsPage } from "./CreditsPage";

// `TransitionLink` calls `useRouter()`, which throws outside a real Next.js App Router tree.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("CreditsPage", () => {
  it("renders the heading and every credited source", () => {
    render(<CreditsPage />);

    expect(screen.getByRole("heading", { name: "Credits & Licenses" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "tarkov.dev" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "the-hideout/tarkov-dev-svg-maps" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Escape from Tarkov Wiki (Fandom)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "re3mr (reemr.se)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "TarkovBOT.eu" })).toBeInTheDocument();
  });

  it("links the SVG maps source to its noncommercial license text", () => {
    render(<CreditsPage />);

    // Second "View license" link, per `CREDITS`' declared order: tarkov.dev, then the SVG maps repo.
    const licenseLink = screen.getAllByRole("link", { name: /View license/ })[1];
    expect(licenseLink).toHaveAttribute(
      "href",
      "https://github.com/the-hideout/tarkov-dev-svg-maps/blob/main/LICENSE.md",
    );
  });
});
