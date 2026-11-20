import { render, screen, within } from "@testing-library/react";
import { Calculator, Wrench } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { ResourcesPage } from "./ResourcesPage";

import type { CommunityResource, HostedResource } from "../data/resources";

// `TransitionLink` calls `useRouter()`, which throws outside a real Next.js App Router tree.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const HOSTED: HostedResource = {
  slug: "test-calculator",
  title: "Test Calculator",
  summary: "Works out a thing.",
  kind: "calculator",
  modes: "all",
  checked: "2026-11",
  icon: Calculator,
};

const COMMUNITY: CommunityResource = {
  title: "Example Site",
  description: "Does something useful.",
  url: "https://example.com",
  hostname: "example.com",
  category: "Tools",
  icon: Wrench,
};

describe("ResourcesPage", () => {
  it("lists hosted resources first, linking to their own pages", () => {
    render(<ResourcesPage hosted={[HOSTED]} community={[COMMUNITY]} />);

    expect(screen.getByRole("heading", { level: 1, name: "Resources" })).toBeInTheDocument();
    const sections = screen.getAllByRole("region");
    expect(sections.map((section) => section.id)).toEqual(["on-tarkovguides", "community"]);
    const hosted = screen.getByRole("region", { name: "On TarkovGuides" });
    expect(within(hosted).getByRole("link", { name: /Open calculator/ })).toHaveAttribute(
      "href",
      "/resources/test-calculator",
    );
  });

  it("opens community links in a new tab and names where they go", () => {
    render(<ResourcesPage hosted={[HOSTED]} community={[COMMUNITY]} />);

    const link = screen.getByRole("link", { name: /Example Site/ });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAccessibleName(/opens example\.com in a new tab/);
  });

  it("leaves out the hosted section and jump links when nothing is hosted", () => {
    render(<ResourcesPage hosted={[]} community={[COMMUNITY]} />);

    expect(screen.getAllByRole("region").map((section) => section.id)).toEqual(["community"]);
    expect(screen.queryByRole("navigation", { name: "On this page" })).not.toBeInTheDocument();
  });

  it("renders the real lists by default", () => {
    render(<ResourcesPage />);

    expect(screen.getByRole("link", { name: /Open calculator/ })).toHaveAttribute(
      "href",
      "/resources/flea-fee-calculator",
    );
    expect(screen.getByRole("link", { name: /Join Discord/ })).toHaveAttribute(
      "href",
      "https://discord.gg/the-sog",
    );
  });
});
