import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ControlRequestPrompt } from "./ControlRequestPrompt";

describe("ControlRequestPrompt", () => {
  it("renders nothing (dialog closed) when there's no pending request", () => {
    render(<ControlRequestPrompt request={null} onRespond={vi.fn()} />);
    expect(screen.queryByText("Control request")).not.toBeInTheDocument();
  });

  it("shows the requester's name when a request is pending", () => {
    render(
      <ControlRequestPrompt request={{ fromId: "p2", fromName: "Bob" }} onRespond={vi.fn()} />,
    );
    expect(screen.getByText(/Bob wants to drive/)).toBeInTheDocument();
  });

  it("calls onRespond(true) for Grant control", async () => {
    const onRespond = vi.fn();
    render(
      <ControlRequestPrompt request={{ fromId: "p2", fromName: "Bob" }} onRespond={onRespond} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Grant control" }));
    expect(onRespond).toHaveBeenCalledWith(true);
  });

  it("calls onRespond(false) for Deny", async () => {
    const onRespond = vi.fn();
    render(
      <ControlRequestPrompt request={{ fromId: "p2", fromName: "Bob" }} onRespond={onRespond} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Deny" }));
    expect(onRespond).toHaveBeenCalledWith(false);
  });
});
