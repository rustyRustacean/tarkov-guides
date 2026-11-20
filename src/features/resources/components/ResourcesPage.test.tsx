import { render, screen, within } from "@testing-library/react";
import { Calculator, MessagesSquare, Wrench } from "lucide-react";
import { describe, expect, it, vi } from "vitest";

import { groupCardPlacement, ResourcesPage } from "./ResourcesPage";

import type { CommunityPreview } from "../data/community-previews";
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

function site(id: string, group: CommunityResource["group"]): CommunityResource {
  return {
    id,
    group,
    title: `Site ${id}`,
    description: "Does something useful.",
    url: `https://${id}.example.com`,
    hostname: `${id}.example.com`,
    category: "Tools",
    icon: group === "discords" ? MessagesSquare : Wrench,
  };
}

function preview(id: string, scroll: boolean): CommunityPreview {
  return {
    url: `https://${id}.example.com`,
    src: `/images/community/${id}.jpg`,
    width: 1280,
    height: scroll ? 3200 : 800,
    scroll,
    capturedAt: "2026-11-20",
  };
}

const COMMUNITY = [
  site("lead", "tools"),
  site("side", "tools"),
  site("bare", "tools"),
  site("chat", "discords"),
];
const PREVIEWS = { lead: preview("lead", true), side: preview("side", false) };

describe("ResourcesPage", () => {
  it("lists hosted resources first, linking to their own pages", () => {
    render(<ResourcesPage hosted={[HOSTED]} community={COMMUNITY} previews={PREVIEWS} />);

    expect(screen.getByRole("heading", { level: 1, name: "Resources" })).toBeInTheDocument();
    const top = screen
      .getAllByRole("region")
      .filter((section) => section.id)
      .map((section) => section.id);
    expect(top).toEqual(["on-tarkovguides", "community"]);
    const hosted = screen.getByRole("region", { name: "On TarkovGuides" });
    expect(within(hosted).getByRole("link", { name: /Open calculator/ })).toHaveAttribute(
      "href",
      "/resources/test-calculator",
    );
  });

  it("groups community sites, Discords last", () => {
    render(<ResourcesPage hosted={[]} community={COMMUNITY} previews={PREVIEWS} />);

    const community = screen.getByRole("region", { name: "Around the community" });
    expect(
      within(community)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Data and tools", "Discords"]);
  });

  it("shows a screenshot card for sites with a preview and a row for the rest", () => {
    render(<ResourcesPage hosted={[]} community={COMMUNITY} previews={PREVIEWS} />);

    const tools = screen.getByRole("region", { name: "Data and tools" });
    const links = within(tools).getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "https://lead.example.com",
      "https://side.example.com",
      "https://bare.example.com",
    ]);
    expect(links[0]?.querySelector("img")).not.toBeNull();
    expect(links[2]?.querySelector("img")).toBeNull();
    for (const link of links) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(links[0]).toHaveAccessibleName(/opens lead\.example\.com in a new tab/);
  });

  it("puts the featured Discord and the other Discords under Discords", () => {
    render(<ResourcesPage hosted={[]} community={COMMUNITY} previews={PREVIEWS} />);

    const discords = screen.getByRole("region", { name: "Discords" });
    expect(within(discords).getByRole("link", { name: /Join Discord/ })).toHaveAttribute(
      "href",
      "https://discord.gg/the-sog",
    );
    expect(within(discords).getByRole("link", { name: /Site chat/ })).toHaveAttribute(
      "href",
      "https://chat.example.com",
    );
  });

  it("says when the previews were captured", () => {
    render(<ResourcesPage hosted={[]} community={COMMUNITY} previews={PREVIEWS} />);

    expect(screen.getByText(/captured November 2026/)).toBeInTheDocument();
  });

  it("leaves out the hosted section and jump links when nothing is hosted", () => {
    render(<ResourcesPage hosted={[]} community={COMMUNITY} previews={PREVIEWS} />);

    expect(screen.queryByRole("region", { name: "On TarkovGuides" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "On this page" })).not.toBeInTheDocument();
  });

  it("renders the real lists by default", () => {
    render(<ResourcesPage />);

    expect(screen.getByRole("link", { name: /Open calculator/ })).toHaveAttribute(
      "href",
      "/resources/flea-fee-calculator",
    );
    expect(screen.getByRole("region", { name: "Maps" })).toBeInTheDocument();
  });
});

describe("groupCardPlacement", () => {
  it("fills a three-column row for groups of two and three", () => {
    expect(groupCardPlacement(0, 2)).toBe("sm:col-span-2");
    expect(groupCardPlacement(1, 2)).toBe("sm:col-span-2 lg:col-span-1");
    expect(groupCardPlacement(0, 3)).toBe("sm:col-span-2 lg:row-span-2");
    expect(groupCardPlacement(1, 3)).toBe("");
    expect(groupCardPlacement(2, 3)).toBe("");
  });

  it("spans a lone card across the whole row", () => {
    expect(groupCardPlacement(0, 1)).toBe("sm:col-span-2 lg:col-span-3");
  });
});
