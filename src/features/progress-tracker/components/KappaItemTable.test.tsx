import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { KappaItemTable } from "./KappaItemTable";

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

describe("KappaItemTable", () => {
  it("renders one row per item with name and need", () => {
    render(
      <KappaItemTable
        items={[makeItem(), makeItem({ id: "item-b", name: "Screws", need: 2 })]}
        justGotIds={new Set()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Bolts")).toBeInTheDocument();
    expect(screen.getByText("Screws")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows 'Securing…' for a transitioning item and '✓ Got' for a settled got item", () => {
    render(
      <KappaItemTable
        items={[
          makeItem({ id: "item-a", got: true }),
          makeItem({ id: "item-b", name: "Screws", got: true }),
        ]}
        justGotIds={new Set(["item-a"])}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByText("Securing…")).toBeInTheDocument();
    expect(screen.getByText("✓ Got")).toBeInTheDocument();
  });

  it("shows 'Needed' for an un-got, non-transitioning item", () => {
    render(<KappaItemTable items={[makeItem()]} justGotIds={new Set()} onToggle={vi.fn()} />);
    expect(screen.getByText("Needed")).toBeInTheDocument();
  });

  it("calls onToggle with the item id and name when a row is clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<KappaItemTable items={[makeItem()]} justGotIds={new Set()} onToggle={onToggle} />);

    await user.click(screen.getByRole("button", { name: "Bolts" }));
    expect(onToggle).toHaveBeenCalledWith("item-a", "Bolts");
  });
});
