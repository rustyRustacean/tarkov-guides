import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { MODIFIER_SEASON } from "../data/seasonal-modifiers";
import { savePicks } from "../lib/modifier-picks-storage";

import { SeasonalModifierPlanner } from "./SeasonalModifierPlanner";

const STORAGE_KEY = `tarkovguides.seasonal-modifier-picks.${MODIFIER_SEASON.id}`;

function card(name: RegExp): HTMLElement {
  return screen.getByRole("button", { name });
}

function pointsPanel(): HTMLElement {
  return screen.getByRole("region", { name: "Your points" });
}

beforeEach(() => {
  savePicks(STORAGE_KEY, []);
  window.localStorage.clear();
});

describe("SeasonalModifierPlanner", () => {
  it("shows all three sections, with global modifiers not pickable", () => {
    render(<SeasonalModifierPlanner />);

    for (const title of ["Global modifiers", "Personal positive", "Personal negative"]) {
      expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText("Untar Control")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Untar Control/ })).not.toBeInTheDocument();
  });

  it("tracks the balance as modifiers are picked", () => {
    render(<SeasonalModifierPlanner />);

    fireEvent.click(card(/^Average/));
    expect(card(/^Average/)).toHaveAttribute("aria-pressed", "true");
    expect(within(pointsPanel()).getByText("8 points short")).toBeInTheDocument();

    fireEvent.click(card(/^No Flea Market/));
    expect(within(pointsPanel()).getByText("Plan works")).toBeInTheDocument();
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('["average","no-flea-market"]');

    fireEvent.click(screen.getByRole("button", { name: "Clear 2 picks" }));
    expect(within(pointsPanel()).getByText("Nothing picked yet")).toBeInTheDocument();
  });

  it("labels confirmed clashes and guesses, and can leave guesses out", () => {
    render(<SeasonalModifierPlanner />);
    fireEvent.click(card(/^Average/));
    fireEvent.click(card(/^Prodigy/));
    fireEvent.click(card(/^Introvert/));

    const clashes = screen.getByRole("region", { name: "Clashes in your picks" });
    expect(within(clashes).getByText("Average and Prodigy")).toBeInTheDocument();
    expect(within(clashes).getByText("Confirmed in Season 1")).toBeInTheDocument();
    expect(within(clashes).getByText("Average and Introvert")).toBeInTheDocument();
    expect(within(clashes).getAllByText("Our guess").length).toBeGreaterThan(0);
    expect(card(/^Introvert/)).toHaveTextContent("Clashes with Average (our guess)");
    expect(card(/^Prodigy/)).toHaveTextContent("Clashes with Average (Season 1)");

    fireEvent.click(within(clashes).getByLabelText("Include our guesses"));
    expect(within(clashes).queryByText("Average and Introvert")).not.toBeInTheDocument();
    expect(within(clashes).getByText("Average and Prodigy")).toBeInTheDocument();
    expect(card(/^Introvert/)).not.toHaveTextContent("Clashes with");
  });

  it("dims cards outside the highlighted category and polarity", () => {
    render(<SeasonalModifierPlanner />);

    fireEvent.click(screen.getByRole("button", { name: /Hideout & crafting/ }));
    expect(card(/^Advanced Hideout/).className).not.toContain("opacity-30");
    expect(card(/^Sprinter/).className).toContain("opacity-30");

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.click(screen.getByRole("button", { name: "Positive" }));
    expect(card(/^Sprinter/).className).toContain("opacity-30");
    expect(card(/^Exhaustion/).className).not.toContain("opacity-30");
  });

  it("restores saved picks", () => {
    savePicks(STORAGE_KEY, ["lucky"]);
    render(<SeasonalModifierPlanner />);

    expect(card(/^Lucky/)).toHaveAttribute("aria-pressed", "true");
  });
});
