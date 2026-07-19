import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ThemeProvider } from "@/shared/ui/theme/ThemeProvider";

import { Header } from "./Header";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("Header", () => {
  it("renders the wordmark and theme picker", () => {
    render(
      <ThemeProvider>
        <Header />
      </ThemeProvider>,
    );

    expect(screen.getByRole("link", { name: "TarkovGuides" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("button", { name: "Change theme" })).toBeInTheDocument();
  });

  it("links to the Progress Tracker route", () => {
    render(
      <ThemeProvider>
        <Header />
      </ThemeProvider>,
    );

    expect(screen.getByRole("link", { name: "Progress Tracker" })).toHaveAttribute(
      "href",
      "/progress-tracker",
    );
  });

  it("links to the PvP Guide route", () => {
    render(
      <ThemeProvider>
        <Header />
      </ThemeProvider>,
    );

    expect(screen.getByRole("link", { name: "PvP Guide" })).toHaveAttribute("href", "/pvp-guide");
  });

  it("links to the Maps route", () => {
    render(
      <ThemeProvider>
        <Header />
      </ThemeProvider>,
    );

    expect(screen.getByRole("link", { name: "Maps" })).toHaveAttribute("href", "/maps");
  });

  it("links to the FAQ route", () => {
    render(
      <ThemeProvider>
        <Header />
      </ThemeProvider>,
    );

    expect(screen.getByRole("link", { name: "FAQ" })).toHaveAttribute("href", "/faq");
  });

  it("links to the External Resources route", () => {
    render(
      <ThemeProvider>
        <Header />
      </ThemeProvider>,
    );

    expect(screen.getByRole("link", { name: "Resources" })).toHaveAttribute(
      "href",
      "/external-resources",
    );
  });

  it("does not hardcode links to routes that don't exist yet", () => {
    render(
      <ThemeProvider>
        <Header />
      </ThemeProvider>,
    );

    const links = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(links).toEqual([
      "/",
      "/progress-tracker",
      "/pvp-guide",
      "/maps",
      "/faq",
      "/external-resources",
    ]);
  });

  it("shows not-yet-built areas as inert markers, not links", () => {
    render(
      <ThemeProvider>
        <Header />
      </ThemeProvider>,
    );

    for (const label of ["Tutorials", "Ballistics", "Flea Market"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText("Soon")).toHaveLength(3);
    // Confirms the count above didn't sneak in as real links.
    expect(screen.getAllByRole("link")).toHaveLength(6);
  });
});
