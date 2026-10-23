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

// `ProfileSwitcher` always mounts `CharacterStatsDialog`, which calls
// `useTarkovGameData()` regardless of whether it's open (same
// always-mounted-behind-a-dialog pattern as `QuestBoard`'s
// `MapRecommendationDialog`). A never-resolving promise keeps these
// structural tests from making a real (and here, base-URL-less, always
// failing) fetch call, since they don't assert on trader data at all.
vi.mock("@/shared/lib/tarkov-api/fetch-tarkov-data", () => ({
  fetchTarkovGameData: vi.fn(() => new Promise(() => undefined)),
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
        <Header beforeHelp={<CompanionButton />} afterHelp={<ProfileSwitcher />} />
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

  it("links to the help page from a help button", () => {
    renderHeader();

    expect(screen.getByRole("link", { name: "Help" })).toHaveAttribute("href", "/help");
  });

  it("orders the corner controls: companion, help, profile, then the theme picker last", () => {
    renderHeader();

    const companion = screen.getByRole("button", { name: "EFT Companion" });
    const help = screen.getByRole("link", { name: "Help" });
    const profile = screen.getByRole("button", { name: /No Profile/ });
    const theme = screen.getByRole("button", { name: "Change theme" });
    const follows = (a: HTMLElement, b: HTMLElement) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

    expect(follows(companion, help)).toBe(true);
    expect(follows(help, profile)).toBe(true);
    expect(follows(profile, theme)).toBe(true);
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
      "/help",
    ]);
  });
});
