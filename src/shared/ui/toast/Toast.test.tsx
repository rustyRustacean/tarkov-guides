import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Toaster } from "./Toast";
import { toast, useToastStore } from "./toast-store";

describe("Toaster", () => {
  beforeEach(() => {
    useToastStore.setState({ toast: null });
  });

  it("renders the active toast's message and fires its action", async () => {
    const user = userEvent.setup();
    const onUndo = vi.fn();
    render(<Toaster />);

    toast({ message: "Task removed", action: { label: "UNDO", onClick: onUndo } });

    expect(await screen.findByText("Task removed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "UNDO" }));
    expect(onUndo).toHaveBeenCalledOnce();
  });
});
