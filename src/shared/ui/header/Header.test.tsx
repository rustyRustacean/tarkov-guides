import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CompanionButton } from "@/features/companion/CompanionButton";
import { ProfileSwitcher } from "@/features/progress-tracker/components/ProfileSwitcher";
import { ThemeProvider } from "@/shared/ui/theme/ThemeProvider";
import { createTestQueryClient } from "@/test/render-with-providers";

import { Header } from "./Header";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

/**
 * `Header` itself is feature-agnostic (see its own doc comment on
 * `HeaderProps`: `shared/ui` doesn't import from `features/*`), so this
 * test wires in the real `CompanionButton`/`ProfileSwitcher` the same way
 * `src/app/layout.tsx` does, to keep the existing behavioral assertions
 * (profile switcher renders, etc.) meaningful. `CompanionButton` polls the
 * local companion via react-query, so a `QueryClientProvider` ancestor is
 * required; its query is disabled until the panel opens, so no companion
 * fetch happens in these structural tests.
 */
function renderHeader() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <ThemeProvider>
        <Header beforeThemePicker={<CompanionButton />} afterThemePicker={<ProfileSwitcher />} />
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
});
