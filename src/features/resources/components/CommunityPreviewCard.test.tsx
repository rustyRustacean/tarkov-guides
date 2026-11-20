import { render, screen } from "@testing-library/react";
import { Wrench } from "lucide-react";
import { describe, expect, it } from "vitest";

import { CommunityPreviewCard, panDurationMs } from "./CommunityPreviewCard";

import type { CommunityPreview } from "../data/community-previews";
import type { CommunityResource } from "../data/resources";

const RESOURCE: CommunityResource = {
  id: "example",
  group: "tools",
  title: "Example Site",
  description: "Does something useful.",
  url: "https://example.com",
  hostname: "example.com",
  category: "Tools",
  icon: Wrench,
};

function preview(scroll: boolean): CommunityPreview {
  return {
    url: RESOURCE.url,
    src: "/images/community/example.jpg",
    width: 1280,
    height: scroll ? 3200 : 800,
    scroll,
    capturedAt: "2026-11-20",
  };
}

describe("CommunityPreviewCard", () => {
  it("links out in a new tab with the title, description and hostname", () => {
    render(<CommunityPreviewCard resource={RESOURCE} preview={preview(false)} />);

    const link = screen.getByRole("link", { name: /Example Site/ });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveTextContent("Does something useful.");
    expect(link).toHaveTextContent("example.com");
  });

  it("sets up the hover pan only for a scrollable capture", () => {
    const { container, rerender } = render(
      <CommunityPreviewCard resource={RESOURCE} preview={preview(true)} />,
    );
    const img = () => container.querySelector("img");
    expect(img()?.className).toContain("group-hover:object-bottom");
    expect(img()?.getAttribute("style")).toContain("--pan-duration: 6000ms");
    expect(screen.getByText("Hover to scroll")).toBeInTheDocument();

    rerender(<CommunityPreviewCard resource={RESOURCE} preview={preview(false)} />);
    expect(img()?.className).not.toContain("group-hover:object-bottom");
    expect(screen.queryByText("Hover to scroll")).not.toBeInTheDocument();
  });
});

describe("panDurationMs", () => {
  it("scales with page length within 2.5 to 6 seconds", () => {
    expect(panDurationMs(800)).toBe(2500);
    expect(panDurationMs(2400)).toBe(4000);
    expect(panDurationMs(3200)).toBe(6000);
    expect(panDurationMs(20_000)).toBe(6000);
  });
});
