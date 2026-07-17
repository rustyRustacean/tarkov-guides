import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PVP_LEARNING_PATH } from "../lib/pvp-learning-path";

import { PvpGuidePage } from "./PvpGuidePage";

// `TransitionLink` calls `useRouter()`, which throws outside a real Next.js App Router tree.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("PvpGuidePage", () => {
  it("renders the hub title, description, and tier counts", () => {
    render(<PvpGuidePage />);
    expect(screen.getByRole("heading", { name: PVP_LEARNING_PATH.title })).toBeInTheDocument();
    expect(screen.getByText("2 essential")).toBeInTheDocument();
    expect(screen.getByText("2 intermediate")).toBeInTheDocument();
    expect(screen.getByText("2 advanced")).toBeInTheDocument();
  });

  it("shows the Quick Start tab's content by default", () => {
    render(<PvpGuidePage />);
    expect(screen.getByText("Quick Start: The Essentials")).toBeVisible();
  });

  it("disables the Full Guide tab and marks it TBA, leaving Quick Start showing", async () => {
    render(<PvpGuidePage />);
    const fullGuideTab = screen.getByRole("tab", { name: /Full Guide/ });
    expect(fullGuideTab).toBeDisabled();
    expect(screen.getByText("TBA")).toBeInTheDocument();

    await userEvent.click(fullGuideTab);
    expect(screen.getByText("Quick Start: The Essentials")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Essential Foundation" })).not.toBeInTheDocument();
  });
});
