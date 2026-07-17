import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { KappaItemCard } from "./KappaItemCard";

import type { KappaItem } from "../lib/kappa";

function makeItem(overrides: Partial<KappaItem> = {}): KappaItem {
  return {
    id: "item-a",
    name: "Bolts",
    shortName: "Bolts",
    iconLink: null,
    need: 5,
    got: false,
    ...overrides,
  };
}

describe("KappaItemCard", () => {
  it("renders the item name and need count", () => {
    render(<KappaItemCard item={makeItem()} isTransitioning={false} onToggle={vi.fn()} />);
    expect(screen.getByText("Bolts")).toBeInTheDocument();
    expect(screen.getByText("Need 5")).toBeInTheDocument();
  });

  it("shows a 'Securing…' badge while transitioning", () => {
    render(
      <KappaItemCard item={makeItem({ got: true })} isTransitioning={true} onToggle={vi.fn()} />,
    );
    expect(screen.getByText("Securing…")).toBeInTheDocument();
  });

  it("shows a '✓ Got' badge once settled and got", () => {
    render(
      <KappaItemCard item={makeItem({ got: true })} isTransitioning={false} onToggle={vi.fn()} />,
    );
    expect(screen.getByText("✓ Got")).toBeInTheDocument();
  });

  it("calls onToggle with the item id and name when clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<KappaItemCard item={makeItem()} isTransitioning={false} onToggle={onToggle} />);

    await user.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledWith("item-a", "Bolts");
  });
});
