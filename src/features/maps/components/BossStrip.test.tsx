import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BossStrip } from "./BossStrip";

import type { BossStripSide } from "../lib/boss-groups";

describe("BossStrip", () => {
  it("renders nothing for a null side", () => {
    const { container } = render(<BossStrip side={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for a side with an empty pills array", () => {
    const side: BossStripSide = { label: "☀ Day", pills: [] };
    const { container } = render(<BossStrip side={side} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the label and each pill's name + rounded percentage", () => {
    const side: BossStripSide = {
      label: "☀ Day",
      pills: [
        { name: "Reshala", chance: 0.35, count: 1, tone: "warm", imagePortraitLink: null },
        { name: "Goons", chance: 0.302, count: 3, tone: "warm", imagePortraitLink: null },
      ],
    };
    render(<BossStrip side={side} />);
    expect(screen.getByText("☀ Day")).toBeInTheDocument();
    expect(screen.getByText("Reshala")).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument();
    expect(screen.getByText("Goons")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("renders a boss's portrait when one is available, else an initials fallback", () => {
    const side: BossStripSide = {
      label: "☀ Day",
      pills: [
        {
          name: "Killa",
          chance: 0.2,
          count: 1,
          tone: "cool",
          imagePortraitLink: "https://assets.tarkov.dev/killa-portrait.png",
        },
        { name: "Big Pipe", chance: 0.1, count: 1, tone: "cool", imagePortraitLink: null },
      ],
    };
    render(<BossStrip side={side} />);
    const portrait = document.querySelector(
      'img[src="https://assets.tarkov.dev/killa-portrait.png"]',
    );
    expect(portrait).not.toBeNull();
    // No portrait -> two-letter initials badge.
    expect(screen.getByText("BP")).toBeInTheDocument();
  });

  it("mentions grouped count in the title only when count > 1", () => {
    const side: BossStripSide = {
      label: "☾ Night",
      pills: [
        { name: "Cultists", chance: 0.4, count: 2, tone: "warm", imagePortraitLink: null },
        { name: "Killa", chance: 0.2, count: 1, tone: "cool", imagePortraitLink: null },
      ],
    };
    render(<BossStrip side={side} />);
    expect(screen.getByText("Cultists").closest("[title]")).toHaveAttribute(
      "title",
      "Cultists · 40% spawn chance · 2 grouped",
    );
    expect(screen.getByText("Killa").closest("[title]")).toHaveAttribute(
      "title",
      "Killa · 20% spawn chance",
    );
  });
});
