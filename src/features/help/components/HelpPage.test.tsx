import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { HelpPage } from "./HelpPage";

const CARD_NAMES = [
  "Install",
  "The five switches",
  "Mirror devices",
  "Snip the exit list",
  "Pick an exit",
  "Go there",
  "Show all exits",
  "Ruler",
  "Your position",
  "Profile search",
];

function cardFor(name: string): HTMLElement {
  const heading = screen.getByRole("heading", { name });
  const card = heading.closest(".tile");
  if (!(card instanceof HTMLElement)) throw new Error(`No card for ${name}`);
  return card;
}

describe("HelpPage", () => {
  it("shows every feature card with its name as a heading", () => {
    render(<HelpPage />);

    for (const name of CARD_NAMES) {
      expect(screen.getByRole("heading", { name })).toBeInTheDocument();
    }
  });

  it("explains the dots once, near the top", () => {
    render(<HelpPage />);

    const legend = screen.getByLabelText("What the dots mean");
    expect(legend).toHaveTextContent("Orange: needs the companion running");
    expect(legend).toHaveTextContent("Green: works without it");
    expect(legend).toHaveTextContent("Both: has parts of each");
  });

  it("marks each card with the right companion dots", () => {
    render(<HelpPage />);

    const needs = "Needs the companion running";
    const works = "Works without the companion";
    expect(within(cardFor("Install")).getByRole("img", { name: works })).toBeInTheDocument();
    expect(within(cardFor("Show all exits")).getByRole("img", { name: works })).toBeInTheDocument();
    expect(within(cardFor("Ruler")).getByRole("img", { name: works })).toBeInTheDocument();
    expect(
      within(cardFor("Snip the exit list")).getByRole("img", { name: needs }),
    ).toBeInTheDocument();
    expect(within(cardFor("Pick an exit")).getByRole("img", { name: needs })).toBeInTheDocument();
    expect(within(cardFor("Your position")).getByRole("img", { name: needs })).toBeInTheDocument();
    // A card with parts of each gets both.
    expect(
      within(cardFor("Mirror devices")).getByRole("img", { name: `${needs} and ${works}` }),
    ).toBeInTheDocument();
  });

  it("says plain arrows cycle every exit until the exit list is snipped", () => {
    render(<HelpPage />);

    expect(
      within(cardFor("Pick an exit")).getByText(/just cycle through all of the map/),
    ).toBeInTheDocument();
  });

  it("says Profile search is paused instead of promising a stats page that cannot open", () => {
    render(<HelpPage />);

    expect(within(cardFor("Profile search")).getByText(/Paused for now/)).toBeInTheDocument();
  });

  it("filters the cards", async () => {
    const user = userEvent.setup();
    render(<HelpPage />);

    await user.click(screen.getByRole("button", { name: "Set up" }));

    expect(cardFor("Install")).not.toHaveClass("hide");
    expect(cardFor("Ruler")).toHaveClass("hide");
    expect(cardFor("Go there")).toHaveClass("hide");

    await user.click(screen.getByRole("button", { name: "All" }));
    expect(cardFor("Ruler")).not.toHaveClass("hide");
  });
});
