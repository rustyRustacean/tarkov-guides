import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/shared/ui/theme/ThemeProvider";
import { createTestQueryClient } from "@/test/render-with-providers";

import { Header } from "./Header";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

/**
 * The header renders `CompanionButton`, which polls the local companion via
 * react-query, so a `QueryClientProvider` ancestor is required. Its query is
 * disabled until the panel opens, so no companion fetch happens in these
 * structural tests.
 */
function renderHeader() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ThemeProvider>
        <Header />
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("Header", () => {
  it("renders the wordmark and theme picker", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: "TarkovGuides" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Change theme" })).toBeInTheDocument();
  });

  it("renders the profile switcher in the top-right corner", () => {
    renderHeader();

    expect(screen.getByRole("button", { name: /No Profile/ })).toBeInTheDocument();
  });

  it("links to the Progress Tracker route", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: "Progress Tracker" })).toHaveAttribute(
      "href",
      "/progress-tracker",
    );
  });

  it("links to the PvP Guide route", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: "PvP Guide" })).toHaveAttribute("href", "/pvp-guide");
  });

  it("links to the Maps route", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: "Maps" })).toHaveAttribute("href", "/maps");
  });

  it("links to the FAQ route", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
  });

  it("links to the External Resources route", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: "Resources" })).toHaveAttribute(
      "href",
      "/external-resources",
    );
  });

  it("does not hardcode links to routes that don't exist yet", () => {
    renderHeader();

    const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(links).toEqual([
      "/",
      "/pvp-guide",
      "/maps",
      "/progress-tracker",
      "/faq",
      "/external-resources",
    ]);
  });

  it("shows not-yet-built areas as inert markers, not links", () => {
    renderHeader();

    for (const label of ["Quick Tips", "Ballistics", "Flea Market"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Soon")).toHaveLength(3);
    // Confirms the count above didn't sneak in as real links.
    expect(screen.getAllByRole("link")).toHaveLength(6);
  });
});
