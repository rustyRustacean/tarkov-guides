import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PrivacyPage } from "./PrivacyPage";

// `TransitionLink` calls `useRouter()`, which throws outside a real Next.js App Router tree.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("PrivacyPage", () => {
  it("renders the heading and every section", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("heading", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "No accounts, no ad tracking" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What stays in your browser" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Real-time features (Liveblocks)" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Analytics (Vercel)" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The EFT Companion app" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Live game data" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contact" })).toBeInTheDocument();
  });

  it("links to Liveblocks' own privacy policy", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("link", { name: "Liveblocks' own privacy policy" })).toHaveAttribute(
      "href",
      "https://liveblocks.io/privacy-policy",
    );
  });

  it("links back to the Credits page for the full source list", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("link", { name: "Credits page" })).toHaveAttribute("href", "/credits");
  });

  it("links to Vercel's own privacy policy", () => {
    render(<PrivacyPage />);

    expect(screen.getByRole("link", { name: "Vercel's own privacy policy" })).toHaveAttribute(
      "href",
      "https://vercel.com/legal/privacy-policy",
    );
  });
});
