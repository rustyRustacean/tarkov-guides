import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Progress } from "./Progress";

describe("Progress", () => {
  it("exposes the correct progressbar ARIA attributes", () => {
    render(<Progress value={40} max={80} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemax", "80");
  });

  it("defaults max to 100", () => {
    render(<Progress value={25} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "100");
  });
});
