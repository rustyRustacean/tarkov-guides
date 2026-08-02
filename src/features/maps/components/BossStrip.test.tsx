import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BossStrip } from "./BossStrip";

import type { BossPill } from "../lib/boss-groups";

describe("BossStrip", () => {
  it("renders nothing for an empty pills array", () => {
    const { container } = render(<BossStrip pills={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders each pill's name + rounded percentage", () => {
    const pills: BossPill[] = [
      { name: "Reshala", chance: 0.35, tone: "warm", imagePortraitLink: null },
      { name: "Goons", chance: 0.302, tone: "warm", imagePortraitLink: null },
    ];
    render(<BossStrip pills={pills} />);
    expect(screen.getByText("Reshala")).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument();
    expect(screen.getByText("Goons")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("never shows a count - only presence", () => {
    // A faction (many bots) and a solo boss render identically: face, name,
    // chance. No "×N" badge.
    const pills: BossPill[] = [
      { name: "Black Division", chance: 0.4, tone: "warm", imagePortraitLink: null },
    ];
    const { container } = render(<BossStrip pills={pills} />);
    expect(container.textContent).not.toMatch(/×|x\d/);
  });

  it("renders a boss's portrait when one is available, else an initials fallback", () => {
    const pills: BossPill[] = [
      {
        name: "Killa",
        chance: 0.2,
        tone: "cool",
        imagePortraitLink: "https://assets.tarkov.dev/killa-portrait.png",
      },
      { name: "Big Pipe", chance: 0.1, tone: "cool", imagePortraitLink: null },
    ];
    render(<BossStrip pills={pills} />);
    const portrait = document.querySelector(
      'img[src="https://assets.tarkov.dev/killa-portrait.png"]',
    );
    expect(portrait).not.toBeNull();
    // No portrait -> two-letter initials badge.
    expect(screen.getByText("BP")).toBeInTheDocument();
  });

  it("shows a night-only badge glyph and names the condition in the title", () => {
    const pills: BossPill[] = [
      {
        name: "Cultists",
        chance: 0.4,
        tone: "warm",
        imagePortraitLink: null,
        badge: { icon: "☾", title: "night only" },
      },
    ];
    render(<BossStrip pills={pills} />);
    expect(screen.getByText("☾")).toBeInTheDocument();
    expect(screen.getByText("Cultists").closest("[title]")).toHaveAttribute(
      "title",
      "Cultists · 40% spawn chance · night only",
    );
  });

  it("an unbadged pill's title is just name + chance", () => {
    const pills: BossPill[] = [
      { name: "Killa", chance: 0.2, tone: "cool", imagePortraitLink: null },
    ];
    render(<BossStrip pills={pills} />);
    expect(screen.getByText("Killa").closest("[title]")).toHaveAttribute(
      "title",
      "Killa · 20% spawn chance",
    );
  });
});
