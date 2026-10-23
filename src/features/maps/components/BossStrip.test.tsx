import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BossStrip } from "./BossStrip";

import type { BossPill } from "../lib/boss-groups";

function pill(overrides: Partial<BossPill> & Pick<BossPill, "name">): BossPill {
  return { chance: 0.2, tone: "cool", imagePortraitLink: null, mobIds: [], ...overrides };
}

const noop = () => undefined;

describe("BossStrip", () => {
  it("renders nothing for an empty pills array", () => {
    const { container } = render(<BossStrip pills={[]} onSelect={noop} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders each pill's name + rounded percentage", () => {
    const pills = [
      pill({ name: "Reshala", chance: 0.35, tone: "warm" }),
      pill({ name: "Goons", chance: 0.302, tone: "warm" }),
    ];
    render(<BossStrip pills={pills} onSelect={noop} />);
    expect(screen.getByText("Reshala")).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument();
    expect(screen.getByText("Goons")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("never shows a count, only presence", () => {
    // A faction (many bots) and a solo boss render identically: face, name,
    // chance. No "×N" badge.
    const pills = [pill({ name: "Black Division", chance: 0.4, tone: "warm" })];
    const { container } = render(<BossStrip pills={pills} onSelect={noop} />);
    expect(container.textContent).not.toMatch(/×|x\d/);
  });

  it("renders a boss's portrait when one is available, else an initials fallback", () => {
    const pills = [
      pill({ name: "Killa", imagePortraitLink: "https://assets.tarkov.dev/killa-portrait.png" }),
      pill({ name: "Big Pipe", chance: 0.1 }),
    ];
    render(<BossStrip pills={pills} onSelect={noop} />);
    const portrait = document.querySelector(
      'img[src="https://assets.tarkov.dev/killa-portrait.png"]',
    );
    expect(portrait).not.toBeNull();
    // No portrait -> two-letter initials badge.
    expect(screen.getByText("BP")).toBeInTheDocument();
  });

  it("shows a night-only badge glyph and names the condition in the title", () => {
    const pills = [
      pill({
        name: "Cultists",
        chance: 0.4,
        tone: "warm",
        badge: { icon: "☾", title: "night only" },
      }),
    ];
    render(<BossStrip pills={pills} onSelect={noop} />);
    expect(screen.getByText("☾")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cultists/ })).toHaveAttribute(
      "title",
      "Cultists · 40% spawn chance · night only · click for gear & loot",
    );
  });

  it("an unbadged pill's title is name + chance + the gear & loot hint", () => {
    render(<BossStrip pills={[pill({ name: "Killa" })]} onSelect={noop} />);
    expect(screen.getByRole("button", { name: /Killa/ })).toHaveAttribute(
      "title",
      "Killa · 20% spawn chance · click for gear & loot",
    );
  });

  it("each pill is a dialog-opening button that reports the clicked pill and its own element", async () => {
    const onSelect = vi.fn();
    const killa = pill({ name: "Killa", mobIds: ["bossKilla"] });
    render(<BossStrip pills={[pill({ name: "Reshala" }), killa]} onSelect={onSelect} />);

    const button = screen.getByRole("button", { name: /Killa/ });
    expect(button).toHaveAttribute("aria-haspopup", "dialog");
    await userEvent.click(button);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(killa, button);
  });

  it("is keyboard operable", async () => {
    const onSelect = vi.fn();
    render(<BossStrip pills={[pill({ name: "Killa" })]} onSelect={onSelect} />);
    await userEvent.tab();
    expect(screen.getByRole("button", { name: /Killa/ })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
