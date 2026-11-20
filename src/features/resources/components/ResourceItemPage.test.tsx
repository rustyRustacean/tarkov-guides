import { render, screen } from "@testing-library/react";
import { Calculator } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProgressTrackerStore } from "@/features/progress-tracker/store";

import { ResourceItemPage } from "./ResourceItemPage";

import type { HostedResource } from "../data/resources";

// `TransitionLink` calls `useRouter()`, which throws outside a real Next.js App Router tree.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const RESOURCE: HostedResource = {
  slug: "season-planner",
  title: "Season Planner",
  summary: "Plans a season.",
  kind: "planner",
  modes: ["PVP_SEASONAL"],
  checked: "2026-11",
  icon: Calculator,
};

const initialProgressState = useProgressTrackerStore.getInitialState();

beforeEach(() => {
  useProgressTrackerStore.setState(initialProgressState, true);
});

describe("ResourceItemPage", () => {
  it("renders the breadcrumb, title, badges and content", () => {
    render(
      <ResourceItemPage resource={RESOURCE}>
        <p>Tool body</p>
      </ResourceItemPage>,
    );

    expect(screen.getByRole("link", { name: "Resources" })).toHaveAttribute("href", "/resources");
    expect(screen.getByRole("heading", { level: 1, name: "Season Planner" })).toBeInTheDocument();
    expect(screen.getByText("Planner")).toBeInTheDocument();
    expect(screen.getByText("Seasonal only")).toBeInTheDocument();
    expect(screen.getByText("Checked November 2026")).toBeInTheDocument();
    expect(screen.getByText("Tool body")).toBeInTheDocument();
  });

  it("explains when the site's mode isn't one the resource covers", () => {
    useProgressTrackerStore.setState({ activeMode: "PVP" });
    render(<ResourceItemPage resource={RESOURCE}>{null}</ResourceItemPage>);

    expect(screen.getByRole("note")).toHaveTextContent(
      "This covers Seasonal. The site is set to PvP",
    );
  });

  it("says nothing when the mode matches", () => {
    useProgressTrackerStore.setState({ activeMode: "PVP_SEASONAL" });
    render(<ResourceItemPage resource={RESOURCE}>{null}</ResourceItemPage>);

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("never shows the notice for a resource that follows every mode", () => {
    useProgressTrackerStore.setState({ activeMode: "PVE" });
    render(<ResourceItemPage resource={{ ...RESOURCE, modes: "all" }}>{null}</ResourceItemPage>);

    expect(screen.getByText("Follows your game mode")).toBeInTheDocument();
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
