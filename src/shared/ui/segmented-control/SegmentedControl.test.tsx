import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SegmentedControl } from "./SegmentedControl";

const OPTIONS = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Bravo" },
  { value: "c", label: "Charlie" },
] as const;

describe("SegmentedControl", () => {
  it("marks the current value as the checked radio", () => {
    render(<SegmentedControl options={OPTIONS} value="b" onChange={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Alpha" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "Bravo" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Charlie" })).toHaveAttribute("aria-checked", "false");
  });

  it("calls onChange when another option is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedControl options={OPTIONS} value="a" onChange={onChange} />);

    await user.click(screen.getByRole("radio", { name: "Charlie" }));

    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("moves to the next option with ArrowRight, wrapping past the last option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedControl options={OPTIONS} value="c" onChange={onChange} />);

    screen.getByRole("radio", { name: "Charlie" }).focus();
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("moves to the previous option with ArrowLeft, wrapping past the first option", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedControl options={OPTIONS} value="a" onChange={onChange} />);

    screen.getByRole("radio", { name: "Alpha" }).focus();
    await user.keyboard("{ArrowLeft}");

    expect(onChange).toHaveBeenCalledWith("c");
  });

  it("jumps to the first/last option with Home/End", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SegmentedControl options={OPTIONS} value="b" onChange={onChange} />);

    screen.getByRole("radio", { name: "Bravo" }).focus();
    await user.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith("c");

    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("a");
  });

  it("uses the provided aria-label when given", () => {
    render(
      <SegmentedControl options={OPTIONS} value="a" onChange={vi.fn()} aria-label="Letters" />,
    );
    expect(screen.getByRole("radiogroup", { name: "Letters" })).toBeInTheDocument();
  });
});
