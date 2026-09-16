import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { tarkovClock } from "../lib/tarkov-clock";

import { TarkovClock } from "./TarkovClock";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TarkovClock", () => {
  it("renders the current left/right in-game times on mount", () => {
    vi.setSystemTime(0);
    render(<TarkovClock />);
    expect(screen.getByText(tarkovClock("left", 0))).toBeInTheDocument();
    expect(screen.getByText(tarkovClock("right", 0))).toBeInTheDocument();
  });

  it("updates the displayed time after a 1s tick", () => {
    vi.setSystemTime(0);
    render(<TarkovClock />);
    expect(screen.getByText(tarkovClock("left", 0))).toBeInTheDocument();

    vi.setSystemTime(60_000);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText(tarkovClock("left", 60_000))).toBeInTheDocument();
  });

  it("distinguishes the two readouts by tooltip rather than a letter label", () => {
    vi.setSystemTime(0);
    render(<TarkovClock />);
    expect(screen.getByTitle("In-game time (live)")).toHaveTextContent(tarkovClock("left", 0));
    expect(screen.getByTitle("In-game time, 12 hours later (live)")).toHaveTextContent(
      tarkovClock("right", 0),
    );
  });
});
