import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FactionToggle } from "./FactionToggle";

describe("FactionToggle", () => {
  it("marks the current value as the checked radio", () => {
    render(<FactionToggle value="BEAR" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: /BEAR/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /USEC/ })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange when the other option is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FactionToggle value="BEAR" onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: /USEC/ }));

    expect(onChange).toHaveBeenCalledWith("USEC");
  });

  it("switches on arrow-key navigation", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<FactionToggle value="BEAR" onChange={onChange} />);

    screen.getByRole("radio", { name: /BEAR/ }).focus();
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("USEC");
  });

  it("uses the provided aria-label when given", () => {
    render(<FactionToggle value="BEAR" onChange={vi.fn()} aria-label="Starting faction" />);
    expect(screen.getByRole("radiogroup", { name: "Starting faction" })).toBeInTheDocument();
  });
});
